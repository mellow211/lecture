require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { parsePptx } = require('./pptxParser');

const { initDatabase, dbRun, dbGet, dbAll } = require('./database');
const { generateToken, authenticateToken, verifySocketToken } = require('./auth');

const app = express();
const server = http.createServer(app);

// Make sure the uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique safe filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9가-힣]/g, '_');
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ storage });

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir)); // Host uploads directory statically

const PORT = process.env.PORT || 4000;

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Seed DB and start server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// --- REST APIs ---

// 1. Login API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 2. Register API (Open for both Presenters and Students)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required.' });
  }
  if (role !== 'presenter' && role !== 'student') {
    return res.status(400).json({ error: 'Invalid role. Must be presenter or student.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    
    const user = await dbGet('SELECT id, username, role FROM users WHERE username = ?', [username]);
    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 3. User deletion API (Presenter only)
app.delete('/api/auth/users/:username', authenticateToken, async (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only administrators can delete accounts.' });
  }
  if (req.params.username === 'admin') {
    return res.status(400).json({ error: 'Cannot delete the primary admin account.' });
  }

  try {
    const user = await dbGet('SELECT id FROM users WHERE username = ?', [req.params.username]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await dbRun('DELETE FROM users WHERE username = ?', [req.params.username]);
    res.json({ message: `Account '${req.params.username}' deleted successfully.` });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. File Upload API (Only accessible by Presenters/Admins)
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only admins can upload files.' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  // Create public static URL for the file
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  // Extract text slides if the file is PPTX
  const isPptx = path.extname(req.file.originalname).toLowerCase() === '.pptx';
  let slides = [];
  if (isPptx) {
    slides = parsePptx(req.file.path);
  }

  res.status(201).json({
    originalName: req.file.originalname,
    filename: req.file.filename,
    fileUrl: fileUrl,
    mimeType: req.file.mimetype,
    slides: slides
  });
});

// --- Curriculum / Presentations APIs ---

// 5. Get all Presentations (Curriculum sidebar)
app.get('/api/presentations', authenticateToken, async (req, res) => {
  try {
    const list = await dbAll('SELECT * FROM presentations ORDER BY order_index ASC');
    const parsedList = list.map(item => ({
      ...item,
      content_data: JSON.parse(item.content_data)
    }));
    res.json(parsedList);
  } catch (error) {
    console.error('Fetch presentations error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 6. Create new Presentation item
app.post('/api/presentations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only administrators can create presentations.' });
  }

  const { title, source_type, content_data, file_url } = req.body;
  if (!title || !source_type || !content_data) {
    return res.status(400).json({ error: 'Title, source_type and content_data are required.' });
  }

  try {
    const maxOrder = await dbGet('SELECT MAX(order_index) as max_idx FROM presentations');
    const nextIndex = maxOrder && maxOrder.max_idx !== null ? maxOrder.max_idx + 1 : 0;

    const contentString = typeof content_data === 'string' ? content_data : JSON.stringify(content_data);

    await dbRun(
      'INSERT INTO presentations (title, source_type, content_data, file_url, order_index) VALUES (?, ?, ?, ?, ?)',
      [title, source_type, contentString, file_url || null, nextIndex]
    );

    const newItem = await dbGet('SELECT * FROM presentations WHERE id = last_insert_rowid()');
    res.status(201).json({
      ...newItem,
      content_data: JSON.parse(newItem.content_data)
    });
  } catch (error) {
    console.error('Create presentation error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 7. Update Presentation (Edit title, slides, or order)
app.put('/api/presentations/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only administrators can edit presentations.' });
  }
  const { title, content_data, file_url, order_index } = req.body;
  const presentationId = req.params.id;

  try {
    const existing = await dbGet('SELECT * FROM presentations WHERE id = ?', [presentationId]);
    if (!existing) {
      return res.status(404).json({ error: 'Presentation not found.' });
    }

    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedContent = content_data !== undefined 
      ? (typeof content_data === 'string' ? content_data : JSON.stringify(content_data))
      : existing.content_data;
    const updatedFileUrl = file_url !== undefined ? file_url : existing.file_url;
    const updatedIndex = order_index !== undefined ? order_index : existing.order_index;

    await dbRun(
      'UPDATE presentations SET title = ?, content_data = ?, file_url = ?, order_index = ? WHERE id = ?',
      [updatedTitle, updatedContent, updatedFileUrl, updatedIndex, presentationId]
    );

    const updated = await dbGet('SELECT * FROM presentations WHERE id = ?', [presentationId]);
    res.json({
      ...updated,
      content_data: JSON.parse(updated.content_data)
    });
  } catch (error) {
    console.error('Update presentation error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 8. Delete Presentation item
app.delete('/api/presentations/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only administrators can delete presentations.' });
  }

  try {
    const existing = await dbGet('SELECT * FROM presentations WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Presentation not found.' });
    }

    await dbRun('DELETE FROM presentations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Presentation item deleted successfully.' });
  } catch (error) {
    console.error('Delete presentation error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// 9. Real Google Gemini AI Slide Generation API
app.post('/api/ai/generate', authenticateToken, async (req, res) => {
  if (req.user.role !== 'presenter') {
    return res.status(403).json({ error: 'Only administrators can call AI generation.' });
  }

  const { topic } = req.body;
  if (!topic) {
    return res.status(400).json({ error: 'Topic prompt is required.' });
  }

  // Define fallback mock slides if Gemini API Key is missing or invalid
  const generateMockSlides = (topicName) => {
    const gradients = [
      'from-blue-600 via-indigo-600 to-violet-600',
      'from-purple-600 via-pink-600 to-rose-600',
      'from-rose-600 via-orange-600 to-amber-600',
      'from-teal-600 via-emerald-600 to-green-600'
    ];
    return [
      {
        title: `1. ${topicName} 개념 이해 및 아키텍처`,
        subtitle: `Understanding ${topicName}`,
        content: `본 장에서는 ${topicName}의 기초 정의와 핵심 원리를 정리합니다. 실무 도입 시 반드시 고려해야 할 인프라 자원 구성도 및 모범 사례 구조를 설명합니다.`,
        gradient: gradients[0]
      },
      {
        title: `2. ${topicName} 핵심 쟁점 및 해결 방안`,
        subtitle: `Key Challenges & Resolutions`,
        content: `${topicName} 개발이나 배포 시 병목 현상이 생길 수 있는 지점들을 진단합니다. 대기 시간을 줄이고 부하 분산을 수행하기 위한 최신 레이어 아키텍처 설계법을 공유합니다.`,
        gradient: gradients[1]
      },
      {
        title: `3. ${topicName} 실무 응용 및 로드맵`,
        subtitle: `Production Application & Future`,
        content: `해외 선두 IT 기업들이 어떻게 ${topicName}을 운영 시스템에 녹여 가치를 끌어내고 있는지 구체적 실무 케이스와 최신 업그레이드 마일스톤 계획을 조명합니다.`,
        gradient: gradients[2]
      }
    ];
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    console.warn('GEMINI_API_KEY is not configured. Falling back to structured mock generation.');
    return res.json({
      title: topic,
      source_type: 'ai',
      content_data: generateMockSlides(topic)
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const systemPrompt = `
      You are an expert curriculum planner and presentation designer.
      Generate 3 logical slides for the lecture topic: "${topic}".
      Return ONLY a JSON array containing precisely 3 slide objects.
      Do not include any wrapping markdown markdown code blocks like \`\`\`json. Just return raw JSON text.
      Each object in the array must strictly have these fields:
      - title: The slide title in Korean (e.g. "1. 개념 및 특징")
      - subtitle: An English subtitle (e.g. "Introduction to Topic")
      - content: High-quality educational content explanation in Korean, 2-3 sentences.
      - gradient: Pick one beautiful CSS gradient from these options:
        - "from-blue-600 via-indigo-600 to-violet-600"
        - "from-purple-600 via-pink-600 to-rose-600"
        - "from-rose-600 via-orange-600 to-amber-600"
        - "from-teal-600 via-emerald-600 to-green-600"
        - "from-indigo-600 via-cyan-600 to-teal-600"
    `;

    const result = await model.generateContent(systemPrompt);
    const textResponse = result.response.text();
    console.log('Gemini raw response:', textResponse);

    let contentData;
    try {
      contentData = JSON.parse(textResponse.trim());
    } catch (parseError) {
      console.error('Failed to parse Gemini text as JSON. Text:', textResponse);
      contentData = generateMockSlides(topic); // Fallback
    }

    res.json({
      title: topic,
      source_type: 'ai',
      content_data: contentData
    });

  } catch (error) {
    console.error('Gemini API call failed:', error);
    // Graceful fallback to avoid server crash or raw 500 error for users
    res.json({
      title: topic,
      source_type: 'ai',
      content_data: generateMockSlides(topic)
    });
  }
});

// --- Socket.io Listeners ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) return next(new Error('Authentication error: Token missing'));

  const decoded = verifySocketToken(token);
  if (!decoded) return next(new Error('Authentication error: Invalid token'));

  socket.user = decoded;
  next();
});

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('ping', () => {
    socket.emit('pong');
  });

  socket.on('room:join', ({ roomId }) => {
    if (currentRoomId) socket.leave(currentRoomId);
    currentRoomId = roomId;
    socket.join(roomId);
    console.log(`Socket joined: ${roomId}`);
  });

  socket.on('slide:change', ({ currentSlide }) => {
    if (!currentRoomId) return;
    io.to(currentRoomId).emit('slide:changed', { currentSlide });
  });

  socket.on('disconnect', () => {
    // Handled silently
  });
});

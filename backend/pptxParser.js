const AdmZip = require('adm-zip');
const path = require('path');

/**
 * Parses a PPTX file and extracts text contents from slides to form slide cards.
 * @param {string} filePath - Absolute path to the PPTX file.
 * @returns {Array} List of slide card objects containing title, subtitle, content, and gradient.
 */
function parsePptx(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    // 1. Gather all slide XML entries in the 'ppt/slides' folder
    const slideEntries = zipEntries.filter(entry => 
      entry.entryName.startsWith('ppt/slides/slide') && 
      entry.entryName.endsWith('.xml')
    );
    
    if (slideEntries.length === 0) {
      console.warn('No slides found in the PPTX archive.');
      return [];
    }

    // 2. Sort slide files numerically (slide1.xml, slide2.xml, ..., slide10.xml)
    slideEntries.sort((a, b) => {
      const matchA = a.entryName.match(/slide(\d+)\.xml/);
      const matchB = b.entryName.match(/slide(\d+)\.xml/);
      
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;
      
      return numA - numB;
    });

    const parsedSlides = [];
    const gradients = [
      'from-blue-600 via-indigo-600 to-violet-600',
      'from-purple-600 via-pink-600 to-rose-600',
      'from-rose-600 via-orange-600 to-amber-600',
      'from-teal-600 via-emerald-600 to-green-600',
      'from-indigo-600 via-cyan-600 to-teal-600'
    ];

    // 3. Extract text from each slide XML
    slideEntries.forEach((entry, idx) => {
      const xmlContent = entry.getData().toString('utf8');
      
      // Match all text nodes <a:t>...</a:t> using regex
      const textMatches = [];
      const tagRegex = /<a:t>([^<]*?)<\/a:t>/g;
      let match;
      while ((match = tagRegex.exec(xmlContent)) !== null) {
        const textVal = match[1].trim();
        if (textVal) {
          textMatches.push(textVal);
        }
      }

      // Group texts into title, subtitle, and body paragraph
      let slideTitle = `제 ${idx + 1}장 - 슬라이드`;
      let slideSubtitle = '';
      let slideContent = '내용 요약이 없는 슬라이드입니다.';

      if (textMatches.length > 0) {
        slideTitle = textMatches[0];
      }
      if (textMatches.length > 1) {
        slideSubtitle = textMatches[1];
      }
      if (textMatches.length > 2) {
        slideContent = textMatches.slice(2).join(' ');
      } else if (textMatches.length === 2) {
        // If only 2 text elements, treat second as main content rather than subtitle
        slideContent = textMatches[1];
        slideSubtitle = '';
      }

      parsedSlides.push({
        title: slideTitle,
        subtitle: slideSubtitle,
        content: slideContent.length > 300 ? slideContent.substring(0, 300) + '...' : slideContent,
        gradient: gradients[idx % gradients.length]
      });
    });

    console.log(`Successfully parsed ${parsedSlides.length} slides from PPTX [${path.basename(filePath)}]`);
    return parsedSlides;

  } catch (error) {
    console.error('Failed parsing PPTX file:', error);
    return [];
  }
}

module.exports = {
  parsePptx
};

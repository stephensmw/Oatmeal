/**
 * MushFormatter - A utility for processing MUSH text formatting
 * Handles ANSI color codes and other text formatting found in MUSH/MUD servers
 */
const MushFormatter = (function() {
    // ANSI color code patterns
    const ANSI_PATTERN = /\x1b\[([\d;]+)m/g;
    
    // ANSI color code mappings
    const ANSI_CODES = {
        0: 'reset',
        1: 'bold',
        2: 'dim',
        3: 'italic',
        4: 'underline',
        5: 'blink',
        7: 'reverse',
        8: 'hidden',
        9: 'strikethrough',
        
        // Foreground colors
        30: 'ansi-black',
        31: 'ansi-red',
        32: 'ansi-green',
        33: 'ansi-yellow',
        34: 'ansi-blue',
        35: 'ansi-magenta',
        36: 'ansi-cyan',
        37: 'ansi-white',
        
        // Bright foreground colors
        90: 'ansi-bright-black',
        91: 'ansi-bright-red',
        92: 'ansi-bright-green',
        93: 'ansi-bright-yellow',
        94: 'ansi-bright-blue',
        95: 'ansi-bright-magenta',
        96: 'ansi-bright-cyan',
        97: 'ansi-bright-white',
        
        // Background colors
        40: 'bg-black',
        41: 'bg-red',
        42: 'bg-green',
        43: 'bg-yellow',
        44: 'bg-blue',
        45: 'bg-magenta',
        46: 'bg-cyan',
        47: 'bg-white',
        
        // Bright background colors
        100: 'bg-bright-black',
        101: 'bg-bright-red',
        102: 'bg-bright-green',
        103: 'bg-bright-yellow',
        104: 'bg-bright-blue',
        105: 'bg-bright-magenta',
        106: 'bg-bright-cyan',
        107: 'bg-bright-white'
    };
    
    /**
     * Process ANSI color codes in text and convert to HTML with css classes
     * @param {string} text - The text with ANSI codes to process
     * @returns {string} HTML with appropriate css classes
     */
    function processAnsiCodes(text) {
        if (!text) return '';
        
        // Replace null bytes and other control characters that might cause display issues
        text = text.replace(/\x00/g, '')
                   .replace(/\x07/g, '') // Bell
                   .replace(/\x08/g, '') // Backspace
                   .replace(/\x0B/g, '') // Vertical tab
                   .replace(/\x0C/g, '') // Form feed
                   .replace(/\x0E/g, '') // Shift out
                   .replace(/\x0F/g, '') // Shift in
                   .replace(/\x1B\[\?[0-9;]*[a-zA-Z]/g, ''); // Extended ANSI sequences
        
        let result = '';
        let lastIndex = 0;
        let currentClasses = [];
        let match;
        
        // Reset the regex matcher
        ANSI_PATTERN.lastIndex = 0;
        
        while ((match = ANSI_PATTERN.exec(text)) !== null) {
            // Add the text before this match
            result += escapeHtml(text.substring(lastIndex, match.index));
            
            // Process the ANSI codes
            const codes = match[1].split(';').map(code => parseInt(code, 10));
            
            // Handle the codes
            for (const code of codes) {
                if (code === 0) {
                    // Reset all formatting
                    if (currentClasses.length > 0) {
                        result += '</span>';
                        currentClasses = [];
                    }
                } else if (ANSI_CODES[code]) {
                    // Add the class for this code
                    if (code >= 30) {
                        // For colors, remove any existing color classes
                        currentClasses = currentClasses.filter(cls => !cls.startsWith('ansi-') && !cls.startsWith('bg-'));
                    }
                    
                    currentClasses.push(ANSI_CODES[code]);
                    
                    // Close and reopen span with updated classes
                    if (currentClasses.length > 0) {
                        result += '</span>';
                    }
                    result += `<span class="${currentClasses.join(' ')}">`;
                }
            }
            
            lastIndex = ANSI_PATTERN.lastIndex;
        }
        
        // Add the remaining text
        result += escapeHtml(text.substring(lastIndex));
        
        // Close any open spans
        if (currentClasses.length > 0) {
            result += '</span>';
        }
        
        return result;
    }
    
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Process MUSH-specific formatting
     * @param {string} text - The text to process
     * @returns {string} Processed text
     */
    function processMushFormatting(text) {
        // This would handle MUSH-specific formatting codes
        // Implement as needed based on specific MUSH server requirements
        return text;
    }
    
    // Public API
    return {
        processAnsiCodes,
        processMushFormatting
    };
})();

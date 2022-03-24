"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.textCommands = void 0;

const vscode = require("vscode");
const pl = require("../pylex");

exports.textCommands = [
    {
        name: 'mind-reader.getLineNumber',
        callback: getLineNumber,
    },
    {
        name: 'mind-reader.getIndent',
        callback: getIndent,
    },
    {
        name: 'mind-reader.getLeadingSpaces',
        callback: getLeadingSpaces,
    },
    {
        name: 'mind-reader.runLineContext',
        callback: runLineContext,
    },
    {
        name: 'mind-reader.runCursorContext',
        callback: runCursorContext
    }
];

/* Helper Function
 * This function returns the line number of the active text editor window
 */
function fetchLineNumber(editor) {
    return editor.selection.active.line + 1;
}

/* Helper Function
 * This function returns the text from the current line of the active text editor window
 */
function fetchTextLine(editor) {
    return editor.document.lineAt(fetchLineNumber(editor) - 1);
}

// Function that outputs the current line number the cursor is on
function getLineNumber() {
    let editor = vscode.window.activeTextEditor;

    if (editor) {
        let lineNum = fetchLineNumber(editor);
        vscode.window.showInformationMessage(`Line ${lineNum.toString()}`);
    } else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function getIndent() {
    let editor = vscode.window.activeTextEditor;

    if (editor) {
        let lineNum = fetchLineNumber(editor);
        let textLine = fetchTextLine(editor);

        if (textLine.isEmptyOrWhitespace) {
            vscode.window.showInformationMessage(`Line ${lineNum.toString()} is Empty`);
        } else {
            // Grab tab format from open document
            let tabFmt = {
                size: editor.options.tabSize,
                hard: !editor.options.insertSpaces
            };
            let i = pl.Lexer.getIndent(textLine.text, tabFmt);

            // Ternary operator to change the tense of 'indent' to 'indents' for the output if i is greater than 1
            (i > 1) ?
            vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${i.toString()} indents`):
                vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${i.toString()} indent`);
        }
    } else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

/* Function -> Returns the number of leading spaces on the line the cursor is on
 * There are two methods that can be used to find the leading spaces:
 *  method 1:
 *      calculates the number of leading spaces by finding the length of the current line
 *      then subtracting from that the length of the text after trimming the whitespace at the start
 *      which will equal the number of whitespace characters
 * 
 *      TO-USE: set calculateLeadingSpaces to true
 * 
 * method 2 (default):
 *      finds the index position of the first non-whitespace character in a 0-index
 *      this number will equal the number of spaces preceding the non-whitespace character
 *      due to the nature of 0-indexes.
 * 
 *      TO-USE: set calculateLeadingSpaces to false
 */
function getLeadingSpaces() {
    let editor = vscode.window.activeTextEditor;

    if (editor) {
        const lineNum = fetchLineNumber(editor);
        const textLine = fetchTextLine(editor);

        if (textLine.isEmptyOrWhitespace) {
            vscode.window.showInformationMessage(`Line ${lineNum.toString()} is empty`);
        } else {
            /*
             * set  true to use method 1: find the number of leading spaces through arithmetic
             * set false to use method 2: find the index position of the first non-whitespace character in a 0-index
             * 
             * default: false
             */
            const calculateLeadingSpaces = false; // change boolean value to change method
            const numSpaces = (calculateLeadingSpaces === true) ?
                pl.Lexer.getLeadingSpacesByArithmetic(textLine) :
                pl.Lexer.getLeadingSpacesByIndex(textLine);

            /* Ternary operator to change the tense of 'space' to 'spaces' for the output if numSpaces is greater than 1 */
            (numSpaces > 1) ?
            vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${numSpaces.toString()} spaces`):
                vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${numSpaces.toString()} space`);
        }
    } else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function runLineContext() {
    let editor = vscode.window.activeTextEditor;

    if (editor) {
        // current text and line number
        let editorText = editor.document.getText();
        let line = editor.selection.active.line;
        // get tab info settings
        let size = parseInt(editor.options.tabSize);
        let hard = !editor.options.insertSpaces;
        // initialize parser
        let parser = new pl.Parser(editorText, {
            size,
            hard
        });
        parser.parse();
        let context = parser.context(line);
        // build text
        let contentString = createContextString(context, line);

        vscode.window.showInformationMessage(contentString);
    } else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function createContextString(context, line) {
    if (context.length < 1) {
        throw new Error('Cannot create context string for empty context');
    }

    let contextString = 'Line ' + (line + 1); // 1 based

    if (context[0].token && context[0].token.attr) {
        contextString += ': ' + context[0].token.type.toString() + ' ' + context[0].token.attr.toString();
    }

    for (let i = 1; i < context.length; i++) {
        let node = context[i];

        if (node.label === 'root') {
            // root
            contextString += ' in the Document Root';
            continue;
        }

        if (node.token.type !== pl.PylexSymbol.EMPTY &&
            node.token.type !== pl.PylexSymbol.INDENT) {
            contextString += ' inside ' + node.token.type.toString();
            if (node.token.attr) {
                contextString += ' ' + node.token.attr.toString();
            }
        }
    }
    return contextString;
}

// find up to `n` words around the cursor, where `n` is
// the value of `#mindReader.reader.contextWindow`
function runCursorContext() {
    let editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('RunCursorContext: No Active Editor');
        return;
    }

    const cursorPos = editor.selection.active;
    const text = editor.document.lineAt(cursorPos).text;
    const windowSize = vscode.workspace.getConfiguration('mindReader').get('reader.contextWindow');
    let trimmedText = text.trimStart(); // trim leading whitespace
    let leadingWS = text.length - trimmedText.length; // # of characters of leading whitespace
    trimmedText = trimmedText.trimEnd(); // trim trailing whitespace
    let pos = leadingWS;
    let maxPos = text.length;
    // clamp cursor start/end to new range
    let col = cursorPos.character; // effective column of the cursor position

    if (col < leadingWS) {
        // move effective start to first non-whitespace character in the line
        col = leadingWS;
    } else if (col > leadingWS + trimmedText.length - 1) {
        // move effective end to last non-whitespace character in the line
        col = leadingWS + trimmedText.length - 1;
    }

    // generate list of space separate words with range data (start, end)
    // TODO: can find user position to be done in one pass
    let spaceWords = [];

    while (pos < maxPos && trimmedText.length > 0) {
        let word = trimmedText.replace(/ .*/, '');

        spaceWords.push({
            word,
            start: pos,
            end: pos + word.length
        });
        // remove processed word from trimmed text
        const oldText = trimmedText;
        trimmedText = trimmedText.replace(/[^ ]+/, '').trimStart();
        // update pos to start of next word
        pos += oldText.length - trimmedText.length;
    }
    // find word the user is in
    let contextStart = -1,
        contextEnd = -1;

    for (let i = 0; i < spaceWords.length; i++) {
        if (col >= spaceWords[i].start && col <= spaceWords[i].end) {
            // found the word
            contextStart = Math.max(0, i - windowSize); // clamp start index
            contextEnd = Math.min(spaceWords.length, i + windowSize + 1); // clamp end index
            // construct cursor context string
            let contextString = '';

            for (let i = contextStart; i < contextEnd; i++) {
                contextString += spaceWords[i].word + ' ';
            }
            // output cursor context string
            vscode.window.showInformationMessage(contextString);
            return;
        }
    }
}
//# sourceMappingURL=text.js.map
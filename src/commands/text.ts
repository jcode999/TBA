"use strict";
import { CommandEntry } from './commandEntry';
import vscode = require("vscode");
import pl = require("../pylex");

type TextEditor = vscode.TextEditor | undefined;

export const textCommands: CommandEntry[] = [
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
function fetchLineNumber(editor: TextEditor): number {
    return editor? editor.selection.active.line + 1: -1;
}

/* Helper Function
 * This function returns the text from the current line of the active text editor window
 */
function fetchTextLine(editor: TextEditor): vscode.TextLine|undefined {
    return editor? editor.document.lineAt(fetchLineNumber(editor) - 1): undefined;
}

// Function that outputs the current line number the cursor is on
function getLineNumber(): void {
    const editor: TextEditor = vscode.window.activeTextEditor;

    if (editor) {
        const lineNum: number = fetchLineNumber(editor);

        vscode.window.showInformationMessage(`Line ${lineNum.toString()}`);
    }
    else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function getIndent(): void {
    const editor: TextEditor = vscode.window.activeTextEditor;

    if (editor) {
        const lineNum: number = fetchLineNumber(editor);
        const textLine: vscode.TextLine = editor.document.lineAt(lineNum - 1);

        if (textLine.isEmptyOrWhitespace) {
            vscode.window.showInformationMessage(`Line ${lineNum.toString()} is Empty`);
        }
        else {
            // Grab tab format from open document
            const tabFmt: pl.TabInfo = {
                size: typeof editor.options.tabSize === 'number'? editor.options.tabSize: 4,
                hard: !editor.options.insertSpaces
            };
            const i: number = pl.Lexer.getIndent(textLine.text, tabFmt);

            vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${i.toString()} indents`);
        }
    }
    else {
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
function getLeadingSpaces(): void {
    const editor: any = vscode.window.activeTextEditor;

    if (editor) {
        const lineNum: number = fetchLineNumber(editor);
        const textLine: vscode.TextLine|undefined = fetchTextLine(editor);
        // If there's no line, or the line is empty, say the line is empty
        if (!textLine || textLine.isEmptyOrWhitespace) {
            vscode.window.showInformationMessage(`Line ${lineNum.toString()} is empty`);
        }
        else {
            /*
             * set  true to use method 1: find the number of leading spaces through arithmetic
             * set false to use method 2: find the index position of the first non-whitespace character in a 0-index
             *
             * default: false
             */
            const calculateLeadingSpaces: boolean = false; // change boolean value to change method
            const numSpaces: number = (calculateLeadingSpaces) ?
                pl.Lexer.getLeadingSpacesByArithmetic(textLine) :
                pl.Lexer.getLeadingSpacesByIndex(textLine);

            /* Ternary operator to change the tense of 'space' to 'spaces' for the output if numSpaces is 0 or greater than 1 */
            (numSpaces !== 1) ?
            vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${numSpaces.toString()} spaces`):
                vscode.window.showInformationMessage(`Line ${lineNum.toString()}: ${numSpaces.toString()} space`);
        }
    }
    else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function runLineContext(): void {
    const editor: TextEditor = vscode.window.activeTextEditor;

    if (editor) {
        // current text and line number
        const editorText: string = editor.document.getText();
        const line: number = editor.selection.active.line;
        // get tab info settings
        const size: number = typeof editor.options.tabSize === 'number'? editor.options.tabSize: 4;
        const hard: boolean = !editor.options.insertSpaces;
        // initialize parser
        const parser: pl.Parser = new pl.Parser(editorText, {
            size,
            hard
        });

        parser.parse();
        const context: pl.LexNode[] = parser.context(line);
        // build text
        const contentString: string = createContextString(context, line);

        vscode.window.showInformationMessage(contentString);
    }
    else {
        vscode.window.showErrorMessage('No document currently active');
    }
}

function createContextString(context: pl.LexNode[], line: number): string {
    if (context.length < 1) {
        throw new Error('Cannot create context string for empty context');
    }

    let contextString: string = `Line ${line + 1}`; // 1 based

    if (context[0].token && context[0].token.attr) {
        contextString += ': ' + context[0].token.type.toString() + ' ' + context[0].token.attr.toString();
    }

    for (let i: number = 1; i < context.length; i++) {
        const node: pl.LexNode = context[i];

        if (node.label === 'root') {
            // root
            contextString += ' in the Document Root';
            continue;
        }

        if (node.token && node.token.type !== pl.PylexSymbol.EMPTY &&
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
function runCursorContext(): void {
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('RunCursorContext: No Active Editor');
        return;
    }

    const cursorPos: vscode.Position = editor.selection.active;
    const text: string = editor.document.lineAt(cursorPos).text;
    const windowSize: any = vscode.workspace.getConfiguration('mindReader').get('reader.contextWindow');
    let trimmedText: string = text.trimStart(); // trim leading whitespace
    const leadingWS: number = text.length - trimmedText.length; // # of characters of leading whitespace
    let pos: number = leadingWS;
    const maxPos: number = text.length;
    // clamp cursor start/end to new range
    let col: number = cursorPos.character; // effective column of the cursor position

    trimmedText = trimmedText.trimEnd(); // trim trailing whitespace

    if (col < leadingWS) {
        // move effective start to first non-whitespace character in the line
        col = leadingWS;
    }
    else if (col > leadingWS + trimmedText.length - 1) {
        // move effective end to last non-whitespace character in the line
        col = leadingWS + trimmedText.length - 1;
    }

    // generate list of space separate words with range data (start, end)
    // TODO: can find user position to be done in one pass
    const spaceWords: any[] = [];

    while (pos < maxPos && trimmedText.length > 0) {
        const word: string = trimmedText.replace(/ .*/, '');

        spaceWords.push({
            word,
            start: pos,
            end: pos + word.length
        });

        // remove processed word from trimmed text
        const oldText: string = trimmedText;
        trimmedText = trimmedText.replace(/[^ ]+/, '').trimStart();
        // update pos to start of next word
        pos += oldText.length - trimmedText.length;
    }

    // find word the user is in
    let contextStart: number = -1;
    let contextEnd: number = -1;

    for (let i: number = 0; i < spaceWords.length; i++) {
        if (col >= spaceWords[i].start && col <= spaceWords[i].end) {
            // found the word
            contextStart = Math.max(0, i - windowSize); // clamp start index
            contextEnd = Math.min(spaceWords.length, i + windowSize + 1); // clamp end index
            // construct cursor context string
            let contextString: string = '';

            for (let i: number = contextStart; i < contextEnd; i++) {
                contextString += spaceWords[i].word + ' ';
            }
            // output cursor context string
            vscode.window.showInformationMessage(contextString);
            return;
        }
    }
}

import * as vscode                                                from "vscode";
import * as pl                                                    from "./pylex";
import CommandNodeProvider                                        from "./commandNodeProvider";
import Logger                                                     from "./log";
import { lineHighlighter }                                        from "./lineHighlighter";
import * as path from 'path';

import { accessCommands, hubCommands, navCommands, textCommands } from "./commands";
import { runClient } from "./client";

// Output Logger
const product: string = vscode.workspace.getConfiguration("mind-reader").get("productType")!;
const outputChannel   = vscode.window.createOutputChannel(product + " Output");
export const logger   = new Logger(outputChannel);

let parser: pl.Parser = new pl.Parser();

export function activate(context: vscode.ExtensionContext) {

	const serverModule = context.asAbsolutePath(
		path.join('node_modules', 'server', 'server.js')
	);

  // Engage LineHighlighter
  lineHighlighter();

  runClient(serverModule);

  parser.parse("Beep Boop");

  const allCommands = [
    accessCommands,
    hubCommands,
    navCommands,
    textCommands,
  ].flat(1);

  // Register Commands
  allCommands.forEach((command) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.name, command.callback)
    );
  });

  let accessProvider = new CommandNodeProvider(
    [accessCommands, textCommands].flat(1)
  );
  vscode.window.registerTreeDataProvider("accessActions", accessProvider);

  let hubProvider = new CommandNodeProvider(hubCommands);
  vscode.window.registerTreeDataProvider("hubActions", hubProvider);

  vscode.window.showInformationMessage("Mind Reader finished loading!");
}

export function deactivate() {}

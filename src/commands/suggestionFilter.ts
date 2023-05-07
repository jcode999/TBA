import * as vscode from 'vscode';
//var player = require('play-sound')(opts= {});


function getReplaceIndex(line:string){
  /**
   * utility function to retrive the index of '.' in a given line
   * @param line the string in current line where the completion was requested
   */
        var position = line.search(/\./);
        if(position!==0){
          return position +1;
        }
        if(line.search('=')!==0){ return line.search('=') + 1;}

        //if '.' not found then return zero
        return 0;
}
//function to auto complete requested text
export async function suggestionFilter() {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return;
	}
	//gather suggestions from Language Server
	const completion = await vscode.commands.executeCommand<vscode.CompletionList[]>(
		'vscode.executeCompletionItemProvider',
		activeEditor.document.uri,
		activeEditor.selection.active,
	);
  //get the current line where cursor is pointed
  var lineAt = activeEditor.selection.active;

	//categorize suggestions
	var functions:vscode.QuickPickItem[] = [];
	var methods:vscode.QuickPickItem[] = [];
	var constructor:vscode.QuickPickItem[] = [];
  var fields:vscode.QuickPickItem[] = [];
  var variables:vscode.QuickPickItem[] = [];
  var classes:vscode.QuickPickItem[] = [];
  var interfaces:vscode.QuickPickItem[] = [];
  var modules:vscode.QuickPickItem[] = [];
  var property:vscode.QuickPickItem[] = [];
	/* although the text editor marks the following code as error,
	no issues are detected while running the program and generates expected results */

  //item.kind is a inbuilt property defined by the langugage server
  //fill the categories based on its kind
	for(var item of completion.items){
     if(item.kind===1){
      methods.push(item);
    }
		else if(item.kind ===2){
			functions.push(item);
		}

    else if(item.kind===3){
      constructor.push(item);
    }
    else if(item.kind===4){
      fields.push(item);
    }
    else if(item.kind===5){
      variables.push(item);
    }
    else if(item.kind===6){
      classes.push(item);
    }
    else if(item.kind===7){
      interfaces.push(item);
    }
    else if(item.kind===8){
      modules.push(item);
    }
    else if(item.kind===9){
      property.push(item);
    }

	}
	/*test for the above bug
	console.log("List of functions: ");
	for(var i of functions)
	{
		console.log(i.label);
	}*/
	//show user types of suggestions they are looking for
	var options:vscode.QuickPickItem[] = [];
  options.push({label:'Functions'});
	options.push({label:'Attribute'});
  options.push({label:'Constructor'});
  options.push({label:'Fields'});
  options.push({label:'Variables'});
  options.push({label:'Classes'});
  options.push({label:'Interfaces'});
  options.push({label:'Modules'});
  options.push({label:'Properties'});

	const kindQp = vscode.window.createQuickPick();
	kindQp.items = options;
	kindQp.show();
	kindQp.onDidAccept(()=>{
		var selectedKind = kindQp.selectedItems[0].label;
		const selectQp = vscode.window.createQuickPick();
		if(selectedKind==='Functions')
		{
			selectQp.items = functions;
		}
    else if(selectedKind==='Classes')
    {
      selectQp.items = classes;
    }
    else if(selectedKind==='Variables')
    {
      selectQp.items = variables;
    }
    //todo -- harish

    //follow the above if else pattern and complete the rest

		selectQp.show();
		selectQp.onDidAccept(()=>{
		activeEditor.edit(editBuilder =>{
    const replacePosition = getReplaceIndex(activeEditor.document.lineAt(lineAt).text);
    var startPosition = new vscode.Position(lineAt.line,replacePosition);
    var endPosition = new vscode.Position(lineAt.line,activeEditor.document.lineAt(lineAt).text.length);
    var range = new vscode.Range(startPosition,endPosition);
    //delete first
    editBuilder.delete(range);
    //then replace
		editBuilder.replace(startPosition,selectQp.selectedItems[0].label);
		}).then(success=>{
      if(success){
        selectQp.dispose();
        /*the editor selects the entire texts that has been completed which causes the complete text to be replaced
        if we immediatedly start typing after completion. To solve this create a new selection with position marking
        the end of the completed text*/
        var postion = activeEditor.selection.end;
        activeEditor.selection = new vscode.Selection(postion, postion);
      }
    });
	});
	kindQp.dispose();
	});

}






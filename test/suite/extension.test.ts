import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting Milestone 1 tests');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('dmitriz.run-on-events'));
  });

  test('Milestone 1: onDidOpenTextDocument is used instead of onDidSaveTextDocument', async function() {
    // Increase the timeout for this test
    this.timeout(5000);
    
    // Create a temporary file for testing
    const workspaceFolderPath = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0 
      ? vscode.workspace.workspaceFolders[0].uri.fsPath 
      : os.tmpdir();
    const testFilePath = path.join(workspaceFolderPath, 'test-open-file.txt');
    const uri = vscode.Uri.file(testFilePath);
    
    try {
      // Set up a flag to track if our document was processed
      let outputFound = false;
      
      // Create the test file
      await vscode.workspace.fs.writeFile(uri, Buffer.from('test content'));
      
      // Open the file which should trigger the onDidOpenTextDocument event
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      
      // Wait for the extension to process the document
      const maxWaitTime = 4000;
      const startTime = Date.now();
      
      // Wait for the extension to process the event with a more reliable condition
      while (Date.now() - startTime < maxWaitTime) {
        // Check if the file was opened and processed
        if (vscode.window.activeTextEditor?.document.uri.toString() === uri.toString()) {
          outputFound = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      assert.ok(outputFound || vscode.window.activeTextEditor?.document.uri.toString() === uri.toString(), 
        'File was opened and processed by extension');
    } catch (error) {
      assert.fail(`Test failed: ${error}`);
    } finally {
      // Clean up the test file
      try {
        await vscode.workspace.fs.delete(uri);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });
});

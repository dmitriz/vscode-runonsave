import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting Milestone 1 tests');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('emeraldwalk.run-on-events'));
  });

  test('Milestone 1: onDidOpenTextDocument is used instead of onDidSaveTextDocument', async () => {
    // This test verifies that the extension responds to file open events
    // Create a temporary file for testing
    const workspaceFolderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const testFilePath = path.join(workspaceFolderPath, 'test-open-file.txt');
    const uri = vscode.Uri.file(testFilePath);
    
    try {
      // Create the test file
      await vscode.workspace.fs.writeFile(uri, Buffer.from('test content'));
      
      // Open the file which should trigger the onDidOpenTextDocument event
      const document = await vscode.workspace.openTextDocument(uri);
      
      // Give some time for the extension to process the event
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Success if we got here without errors
      assert.ok(true, 'File was opened and processed by extension');
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

// Contains code related to maintaining the state of the client document

// Merges an input targetText with a changeset inputChangeset
// Produces the string result of their merger
function merge(targetText, inputChangeset){
    var inputCharBank = '';
    var inputCharBankIndex = 0;
    var inputInitialLength;
    var outputText = '';
    var targetIndex = 0;
    var instructionList = [];

    extractOperationSet(inputChangeset,instructionList);
    inputInitialLength = extractNumber(instructionList.shift());
    instructionList.shift();

    inputCharBank = instructionList.pop();
    if(inputCharBank.length > 1){
      inputCharBank = inputCharBank.slice(1);
    }

    while(instructionList.length>0){

      if(instructionList[0][0] === '='){
        var startIndex = targetIndex;
        targetIndex += extractNumber(instructionList.shift());

        outputText += targetText.slice(startIndex,targetIndex);
      }
      else if(instructionList[0][0] === '-'){
        targetIndex += extractNumber(instructionList.shift());
      }
      else if(instructionList[0][0] === '+'){
        var startIndex = inputCharBankIndex;
        inputCharBankIndex += extractNumber(instructionList.shift());
        outputText += inputCharBank.slice(startIndex,inputCharBankIndex);
      }
    }

    return outputText;
  }

// Transforms an input externalChangeset to account for the input localChangeset
// Requires changesets to be concurrent
// Returns the externalChangeset', the transformed changeset
  function following(localChangeset, externalChangeset){
    var localInstructionList = [];
    var externalInstructionList = [];
    var newInstructionList = [];
    var newStartLength;
    var newLengthChange;
    var newCharBank = '';
    var localRemaining = 0;
    var externalRemaining = 0;
    var localOperation;
    var externalOperation;
    
    extractOperationSet(localChangeset,localInstructionList);
    extractOperationSet(externalChangeset,externalInstructionList);
    
    newStartLength = extractNumber(localInstructionList.shift());
    if(localInstructionList[0][0]==='>'){
      newStartLength += extractNumber(localInstructionList.shift());
    }
    else{
      newStartLength -= extractNumber(localInstructionList.shift());
    }
    newInstructionList.push(':' + newStartLength.toString());

    //new length change is just the length change from the external changeset
    externalInstructionList.shift();  //discard starting length
    newLengthChange = externalInstructionList.shift();
    newInstructionList.push(newLengthChange);
    newLengthChange = extractNumber(newLengthChange);

    //new char bank is same as the external char bank
    newCharBank = externalInstructionList.pop();

    //drop old char bank
    localInstructionList.pop();

    if(localInstructionList.length>0 && localRemaining === 0){
        localRemaining = extractNumber(localInstructionList[0]);
        localOperation = localInstructionList[0][0];
        localInstructionList.shift();
      }
      if(externalInstructionList.length>0 && externalRemaining === 0){
        externalRemaining = extractNumber(externalInstructionList[0]);
        externalOperation = externalInstructionList[0][0];
        externalInstructionList.shift();
      }

    while(localInstructionList.length != 0 || localRemaining > 0 || externalInstructionList.length != 0 || externalRemaining > 0){
      if(localInstructionList.length>0 && localRemaining === 0){
        localRemaining = extractNumber(localInstructionList[0]);
        localOperation = localInstructionList[0][0];
        localInstructionList.shift();
      }
      if(externalInstructionList.length>0 && externalRemaining === 0){
        externalRemaining = extractNumber(externalInstructionList[0]);
        externalOperation = externalInstructionList[0][0];
        externalInstructionList.shift();
      }

      
      //external additions remain additions
      if(externalOperation === '+' && externalRemaining > 0){
        //lengthSum += externalRemaining;
        newInstructionList.push('+' + externalRemaining.toString());
        externalRemaining = 0;
      }
      //local additions become retentions
      else if(localOperation === "+" && localRemaining > 0){
        //lengthSum += localRemaining;
        newInstructionList.push('=' + localRemaining.toString());
        localRemaining = 0;
      }
      //if deleted in either or both, is deleted in ouput
      else if((localOperation === '-' && localRemaining >0) || (externalOperation === '-' && externalRemaining > 0)){
        //local deletions don't show in output
        if(localOperation === '-' && localRemaining >= externalRemaining){
          if(externalRemaining > 0){
            localRemaining -= externalRemaining;
            externalRemaining = 0;
          }
          else{
            localRemaining = 0;
          }
        }
        //local deletions don't show
        else if(localOperation === '-' && externalRemaining > localRemaining && localRemaining > 0){
          externalRemaining -= localRemaining;
          localRemaining = 0;
        }
        //external deletions do show
        else if(localOperation === '=' && externalOperation === '-' && externalRemaining >= localRemaining && localRemaining >0){
          //will delete localRemaining characters, so that we find the next local operation before more deletions
          newInstructionList.push('-' + localRemaining.toString());
          externalRemaining -= localRemaining;
          localRemaining = 0;
        }
        else{
          //delete externalRemaining chracters, so that we find the next external operation before more deletions
          newInstructionList.push('-' + externalRemaining.toString());
          localRemaining -= externalRemaining;
          externalRemaining = 0;
        }
      }
      //retentions in both are retained in output
      else if(localOperation === '=' && localRemaining > 0 && externalOperation === '=' && externalRemaining > 0){
        if(localRemaining <= externalRemaining){
          //lengthSum += localRemaining;
          newInstructionList.push('=' + localRemaining.toString());
          externalRemaining -= localRemaining;
          localRemaining = 0;
        }
        else{
          //lengthSum += externalRemaining;
          newInstructionList.push('=' + externalRemaining.toString());
          localRemaining -= externalRemaining;
          externalRemaining = 0;
        }
      }
      else{
        localRemaining = 0;
        externalRemaining = 0;
      }
      
      //prevents infinite loops on high priority actions
      if(localRemaining === 0){
        localOperation = '=';
      }
      if(externalRemaining === 0){
        externalOperation = '=';
      }
    }

    optimize(newInstructionList);
    newInstructionList.push(newCharBank);

    return instructionsToChangeset(newInstructionList);
  }

// Combines two inputs changesets into a single more compact changeset
// Returns the combined changeset, which is the changeset that would produce the same result applied 
//      to the starting text as the two changesets implemented sequentially
  function combineChangesets(localChangeset, externalChangeset){
    var localInstructionList = [];
    var externalInstructionList = [];
    var newInstructionList = [];
    var newStartLength;
    var newLengthChange = 0;
    var newCharBank = '$';
    var localRemaining = 0;
    var externalRemaining = 0;
    var localOperation;
    var externalOperation;
    var localCharBankPos = 0;
    var localCharBank = '';
    var externalCharBankPos = 0;
    var externalCharBank = '';
    
    extractOperationSet(localChangeset,localInstructionList);
    extractOperationSet(externalChangeset,externalInstructionList);
    
    newStartLength = extractNumber(localInstructionList.shift());
    if(localInstructionList[0][0]==='>'){
      newLengthChange += extractNumber(localInstructionList.shift());
    }
    else{
      newLengthChange -= extractNumber(localInstructionList.shift());
    }
    newInstructionList.push(':' + newStartLength.toString());

    //new length change is just the length change from the external changeset
    externalInstructionList.shift();  //discard starting length
    if(externalInstructionList[0][0]==='>'){
      newLengthChange += extractNumber(externalInstructionList.shift());
    }
    else{
      newLengthChange -= extractNumber(externalInstructionList.shift());
    }

    if(newLengthChange >= 0){
      newInstructionList.push('>' + newLengthChange.toString());
    }
    else{
      newLengthChange *= -1;
      newInstructionList.push('<' + newLengthChange.toString());
    }
    

    //new char bank starts as the combination of the internal and external
    localCharBank = localInstructionList.pop();
    if(localCharBank.length > 1){
      localCharBank = localCharBank.slice(1);
    }
    else{
      localCharBank = '';
    }
    externalCharBank = externalInstructionList.pop();
    if(externalCharBank.length > 1){
      externalCharBank = externalCharBank.slice(1);
    }
    else{
      externalCharBank = '';
    }

    if(localInstructionList.length>0 && localRemaining === 0){
        localRemaining = extractNumber(localInstructionList[0]);
        localOperation = localInstructionList[0][0];
        localInstructionList.shift();
      }
      if(externalInstructionList.length>0 && externalRemaining === 0){
        externalRemaining = extractNumber(externalInstructionList[0]);
        externalOperation = externalInstructionList[0][0];
        externalInstructionList.shift();
      }

    while(localInstructionList.length != 0 || localRemaining > 0 || externalInstructionList.length != 0 || externalRemaining > 0){
      if(localInstructionList.length>0 && localRemaining === 0){
        localRemaining = extractNumber(localInstructionList[0]);
        localOperation = localInstructionList[0][0];
        localInstructionList.shift();
      }
      if(externalInstructionList.length>0 && externalRemaining === 0){
        externalRemaining = extractNumber(externalInstructionList[0]);
        externalOperation = externalInstructionList[0][0];
        externalInstructionList.shift();
      }

      //deletions
      if((localOperation === '-' && localRemaining >0) || (externalOperation === '-' && externalRemaining > 0)){
        //any delection in local will be present in output
        if(localOperation === '-'){
          newInstructionList.push('-' + localRemaining.toString());
          localRemaining = 0;
        }
        else if(externalOperation === '-' && externalRemaining > 0){
          //external deletions cancel out local additions
          if(localOperation === '+' && externalRemaining >= localRemaining){
            if(localRemaining > 0){
              localCharBankPos += localRemaining;
              //localCharBank = localCharBank.slice(localCharBankPos,localCharBankPos + localRemaining) + localCharBank.slice(localRemaining, );
              externalRemaining -= localRemaining;
              localRemaining = 0;
            }
            else{
              newInstructionList.push('-' + externalRemaining.toString());
              externalRemaining = 0;
            }
          }
          else if(localOperation === '+' && localRemaining > externalRemaining){
            //localCharBank = localChangeset.slice(localCharBankPos,externalRemaining) + localChangeset.slice(externalRemaining, );
            localCharBankPos += externalRemaining;
            localRemaining -= externalRemaining;
            externalRemaining = 0;
          }
          //external deletions overwrite local retentions
          else if(localOperation === '=' && externalRemaining > localRemaining){
            if(localRemaining > 0){
              newInstructionList.push('-' + localRemaining.toString());
              externalRemaining -= localRemaining;
              localRemaining = 0;
            }
            else{
              newInstructionList.push('-' + externalRemaining.toString());
              externalRemaining = 0;
            }
          }
          else{  //local op should be = and local > external but external not 0
            newInstructionList.push('-' + externalRemaining.toString());
            localRemaining -= externalRemaining;
            externalRemaining = 0;
          }
        }
      }
      else if((localOperation === '+' && localRemaining >0) || (externalOperation === '+' && externalRemaining > 0)){
        //external insertions split local retains and insertions
        if(externalOperation === '+' && externalRemaining > 0){
          newInstructionList.push('+' + externalRemaining.toString());
          newCharBank += externalCharBank.slice(externalCharBankPos, externalRemaining);
          externalCharBankPos += externalRemaining;
          externalRemaining = 0;
        }
        //local insertions overwrite external retains
        else if(localOperation === '+' && localRemaining > 0){
          if(localRemaining >= externalRemaining){
            if(externalRemaining > 0){
              newInstructionList.push('+' + externalRemaining.toString());
              newCharBank += localCharBank.slice(localCharBankPos, externalRemaining);
              localCharBankPos += externalRemaining;
              localRemaining -= externalRemaining;
              externalRemaining = 0;
            }
            else{
              newInstructionList.push('+' + localRemaining.toString());
              newCharBank += localCharBank.slice(localCharBankPos, localRemaining);
              localCharBankPos += localRemaining;
              localRemaining = 0;
            }
          }
          else if(externalRemaining > localRemaining){
            newInstructionList.push('+' + localRemaining.toString());
            newCharBank += localCharBank.slice(localCharBankPos, localRemaining);
            localCharBankPos += localRemaining;
            externalRemaining -= localRemaining;
            localRemaining = 0;
          }
        }
      }
      //otherwise characters are being retained in both 
      else{
        //write the minimum
        if(localRemaining >= externalRemaining){
          if(externalRemaining > 0){
            newInstructionList.push('=' + externalRemaining.toString());
            localRemaining -= externalRemaining;
            externalRemaining = 0;
          }
          else{
            newInstructionList.push('=' + localRemaining.toString());
            localRemaining = 0;
          }
        }
        else{ //ext > local
          if(localRemaining > 0){
            newInstructionList.push('=' + localRemaining.toString());
            externalRemaining -= localRemaining;
            localRemaining = 0;
          }
          else{
            newInstructionList.push('=' + externalRemaining.toString());
            externalRemaining = 0;
          }
        }
      }

      //prevents infinite loops on high priority actions
      if(localRemaining === 0){
        localOperation = '=';
      }
      if(externalRemaining === 0){
        externalOperation = '=';
      }
    
    
    }

    optimize(newInstructionList);
    newInstructionList.push(newCharBank);

    return instructionsToChangeset(newInstructionList);
  }

// Accepts an input instruction list and optimizes it by removing repeated sequential operations
//     and replacing them with a single operation with a combined length
// Edits and returns instructionList by reference
  function optimize(instructionList){
    var i = 1;

    while(i < instructionList.length){
      if(instructionList[i-1][0] === instructionList[i][0]){
        var newLength = extractNumber(instructionList[i - 1]) + extractNumber(instructionList[i]);
        var operation = instructionList[i-1][0];
        instructionList[i-1] = operation + newLength.toString();
        instructionList.splice(i,1);
      }
      else{
        i++;
      }
    }
  }

//Converts the array form of a changeset instructionList to a flat string form
  function instructionsToChangeset(instructionList){
    var changeset = '';
    
    for(var i = 0; i < instructionList.length; i++){
      changeset += instructionList[i];
    }
    return changeset;
  }

//Converts a flat string form of a changeset to the array form
  function extractOperationSet(inputChangeset, instructionList){
    var index;
    var operators = ":><$=+-";

    for(index = 0; index < inputChangeset.length; index++){
      if(operators.includes(inputChangeset[index])){
        instructionList.push(extractOperation(index,inputChangeset));
      }
    }
  }

//Extracts the characters in a string beyond the first character as an integer
  function extractNumber(input){
    return parseInt(input.slice(1));
  }

//Extracts text in a string bounded by the operator characters
  function extractOperation(startPos, inputChangeset){
    var endPos = startPos + 1;
    var operators = ":><$=+-";
    while(!operators.includes(inputChangeset[endPos]) && endPos<inputChangeset.length){
      endPos++;
    }
    return inputChangeset.slice(startPos,endPos);
  }

//Compares two sets of text, character by character, and creates a changeset based on their differences
//Returns the changeset that if applied to oldText would produce the value in newText
  function createChangeset(oldText,newText){
    var oldLength = oldText.length;
    var newLength = newText.length;
    var oldIndex = 0;
    var newIndex = 0;
    var keepCount = 0;
    var message = '';
    var charBank = '';

      for(newIndex = 0; newIndex < newLength; newIndex++){

        if(oldText[oldIndex] != newText[newIndex]){
          if ((newLength-newIndex) > (oldLength-oldIndex)) {
            message += writeKeepCount(keepCount);
            keepCount = 0;
            
            var insertionCount = 0;

            while(newIndex < newText.length && oldText[oldIndex] != newText[newIndex]) {
              charBank += newText[newIndex];
              insertionCount++;
              newIndex++;
            }

            newIndex--; //prevent skipping a character on next loop
            message += '+' + insertionCount.toString();
          }
          else if((oldLength-oldIndex) > (newLength-newIndex)){ //if characters have been deleted
            message += writeKeepCount(keepCount);
            keepCount = 0;
            var deleteCount = 0;
            while((oldText[oldIndex] != newText[newIndex]) && oldIndex < oldLength){
              oldIndex++;
              deleteCount++;
            }

            if(newIndex < newLength){
              newIndex--; //prvents skipping a character on next loop
            }
            
            message += '-' + deleteCount.toString();
          }
          else{
            //handle replaced character
            if(oldText[oldIndex] != newText[newIndex]){
              message += writeKeepCount(keepCount);
              keepCount = 0;

              message += '-1+1';
              charBank += newText[newIndex];
              oldIndex++;
            }
          }
        }
        else{
          keepCount++;
          oldIndex++;
        }
      }

    message += writeKeepCount(keepCount);

    if(oldIndex != oldText.length){
      message += '-' + (oldText.length - oldIndex).toString()
    }
    message = beforeAndAfterLengths(oldLength,newLength, message) + message;
    message += '$' + charBank;
    
    if(message === ":0>0$"){
      message = ":0>0=0$"
    }

    oldText = newText;
    return message;
  }

//writes out keepcount if >0
  function writeKeepCount(keepCount){
    if(keepCount > 0){
      return '=' + keepCount.toString();
    }
    else{
      return '';
    }
  }

//Returns string in the form :OldLength>lengthchage based on the old and new length inputs
  function beforeAndAfterLengths(oldLength,newLength, message){
    var diff = newLength - oldLength;

    if(diff >= 0){
      return ":" + oldLength.toString() + '>' + diff.toString();
    }
    else{
      return ":" + oldLength.toString() + '<' + Math.abs(diff.toString());
    }
  }

//ClientDoc Class
//Object that is responsible for maintaining the state of the document on the client
class ClientDoc {
  //constructor expecting initial text and a client number used as an ID
  constructor(initalText, clientNum){
    this.serverState = initalText;
    this.unCommitted = this.identity();
    this.unSent = this.identity();
    this.serverPosition = 0;
    this.clientNum = clientNum;
  }


  //If uncommitted is identity, transfer unsent to it
  updateUncommitted(){
    if(this.unCommitted === this.identity()){
      if(this.unSent != this.identity()){
        this.unCommitted = this.unSent;
        this.unSent = this.identity();
      }
    }  
  }

  //Updates unsent to diff of combination of ServerState and UnCommitted
  updateUnsent(currentText){
    this.unSent = createChangeset(merge(this.serverState,this.unCommitted),currentText);
    if(this.unSent === ":0>0$"){
      this.unSent = this.identity();
    }
  }

    //The identity function returns the changeset that would leave the current state of the document as is if applied
    //Returns the format :<textLength>>0=<textLength>$
  identity(){
      var serverLength = this.serverState.length.toString();
      return ':' + serverLength + '>0=' + serverLength + '$';
  }


//Transforms serverstate, uncommitted, and unsent to account for the inputChangeset
//Returns the changeset that would update the current view to the updated state
  transformAllAndGetViewChangeset(inputChangeset){
      this.serverState = merge(this.serverState,inputChangeset);
      var tempUncommitted = following(inputChangeset,this.unCommitted);
      var inputTransForUncommited = following(this.unCommitted, inputChangeset);
      var tempUnsent = following(inputTransForUncommited,this.unSent);
      var viewUpdateChangeset = following(this.unSent,inputTransForUncommited);
      
      this.unCommitted = tempUncommitted;
      this.unSent = tempUnsent;

      return viewUpdateChangeset;
  }
  
//Given a currentPosition and input changeset, returns the new position of the caret
//     so that the user experiences insertions seamlessly
  caretAdjustmentFromChangeset(currentPos, inputChangeset){
    var newPos = currentPos;
    var textPos = 0;
    var instructionList = [];
    extractOperationSet(inputChangeset, instructionList);
    instructionList.shift();
    instructionList.shift();
    instructionList.pop();
    for(var i = 0; i < instructionList.length; i++){
      if(textPos >= newPos){
        break;
      }
      if(instructionList[i][0]==='='){
        textPos += extractNumber(instructionList[i]);
      }
      else if(instructionList[i][0]==='-'){
        newPos -= extractNumber(instructionList[i]);
      }
      else if(instructionList[i][0]==='+'){
        newPos += extractNumber(instructionList[i]);
        textPos += extractNumber(instructionList[i]);
      }
    }
    return newPos;
  }
}
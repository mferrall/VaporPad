//
// Server.js
//
// A simple server using Socket.IO, Express, and Async.
// Contains all code related to the incorportation and distribution of client edits

var dataBase = require('./dataBase.js');
var http = require('http');
var path = require('path');
var redis = require("redis"),//for in-cache m/m
redisClient = redis.createClient();//creates new client


var async = require('async');
var socketio = require('socket.io');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');//for session
var router = express();
var server = http.createServer(router);
var io = socketio.listen(server);

router.use(express.static(path.resolve(__dirname, 'client')));

// session middleware
var sessionMiddleware =session({
    secret: 'secret',
    name: 'sessionid',
    resave: true,
    cookie: { maxAge: null }
});

router.use(bodyParser.urlencoded({extended : true}));
router.use(bodyParser.json());
var messages = [];
var sockets = [];

io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res, next);
});

router.use(sessionMiddleware);

const assert = require('assert');
/********** db *************/
const MongoClient = require('mongodb').MongoClient;
//const assert = require('assert');

// Connection URL
var url = "mongodb://localhost:27017/";

// Database Name 
const dbName = 'myproject';

//checking redis
redisClient.on('connect', function() {
    console.log('Redis client connected');
});
redisClient.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

//creating socket connection 
io.on('connection', function (socket) {
    console.log("Connection Made");
    socket.on('connection',function(msg){
        console.log(msg);
        socket.emit('connection','successful');
    });
    
    //Socket connections helps the client to join room where room# is notepad#
    socket.on('join_room',function(msg){

        socket.join("notepad"+msg.room); //msg.room = notepadId
        console.log('User joined notepad'+msg.room);
        
        //sends content of notepad to client by taking from redis or from db
        if (msg.room ) {
            //first checks if redis has the notepad details
            redisClient.get(msg.room, function(err, reply) {console.log("redis reply.doc 92");console.log(reply);
            if (err) console.log('error: ' + err);
            
                if (reply === null) {//redis value stored for notepad ID is empty
                  console.log('redis empty');
                    //to get name of the notepad
                    dataBase.findNoteName(msg.room, function(nameresponse){
                       
                    //to get content if there
                        dataBase.pullHead(msg.room, function(contentresponse){
                            let serverState = new ServerDoc();
                            serverState.name = nameresponse;
                            serverState.initialState = contentresponse;
                            console.log('initial state new: ' + serverState.initialState);
 
                           //add the client to clientList
                           serverState.id = msg.room;
                           serverState.clientPos.push(0);
                           serverState.clientSocketID.push(socket.id);
                           serverState.revisionHistory.push(serverState.identity());
                           serverState.revisionAuthors.push(-1);
                           console.log('serverState 0: ' + JSON.stringify(serverState));
                           //send the notepad details to client
                           socket.emit('paddetails', {
                                    name: nameresponse,
                                    content: contentresponse,
                                    clientID: 0,
                                    serverPosition: 0
                                   
                            });
                            var session = socket.request.session;
                            var username = session.username;
                            //redis
                            redisClient.set(msg.room, JSON.stringify(serverState), function (err, reply) {
                                 if (err) console.log("error+--"+err);
                                console.log("response--"+reply);
                            });
                        });
                    });

                } else {//vlaues of notepad id is saved in redis
                    //For a new client connecting, send current documentState
                    console.log("exists in redis");
                    let serverState = new ServerDoc();
                    var tempJSONServerState = JSON.parse(reply);console.log("redis response");console.log('initial state existing: '+ tempJSONServerState);
                    serverState.cloneJSON(tempJSONServerState);
                    serverState.clientSocketID.push(socket.id);
                    serverState.clientPos.push(0);
                    var clientNum = serverState.clientPos.length - 1;
                    var positionChangesetPair = serverState.sendChangeset(serverState.clientPos[clientNum], clientNum);
                    console.log("initial merge Cs: " + positionChangesetPair[1]);
                    var clientContent = merge(serverState.initialState,positionChangesetPair[1]);
                    
                    //send values back to client
                    socket.emit('paddetails', {
                        name: serverState.name,
                        content: clientContent,
                        serverPosition: positionChangesetPair[0],
                        clientID: clientNum
                    });
                    redisClient.set(msg.room, JSON.stringify(serverState), function (err, reply) {
                      if (err) console.log("Error from redis on saving content--"+err);
                      console.log("saved--"+reply);
                    });
                }
            });
            
            //Disconnecting from socket ,remove redis based on active clients
            socket.on('disconnect', function () {console.log(socket.id+"got disconnected");
                io.of('/').in("notepad"+msg.room).clients(function(error,clients){
                    var numClients = clients.length;console.log(numClients);
                    combineChangesets(':62<8-5=5-5=3+2=44$i ', ':54>2=9+1=1+1$s ');
                    if(numClients===0) {
                      //saving into Db the last updated note content
                      redisClient.get(msg.room, function(err, reply) {console.log(reply);
                        if (err) console.log('error: ' + err);
                        let serverState = new ServerDoc();
                        var tempJSONServerState = JSON.parse(reply);console.log("redis response");console.log('initial state existing: '+ tempJSONServerState);
                        serverState.cloneJSON(tempJSONServerState);
                        var allChangesetsCombined = serverState.combineAllChangesets(0);
                        var newHead = merge(serverState.initialState,allChangesetsCombined);
                        //saving into Db
                        dataBase.insertHead(msg.room,newHead, function(contentresponse){
                          console.log("Successfully entered");
                        });  
                      });
                      //when all the clients exit from the room delete the key of the particular room from redis
                      redisClient.del(msg.room);
                    }
                });
            });

        } else {
            socket.emit('error','error');
        }
        
    });
    
    socket.on('changesetFromClient', function(id, inputChangeSet, clientNumber, clientsKnownPosition, confirmation){
        //place redis object at key id into serverState object
        let serverState = new ServerDoc();console.log("Inside changesetFromClient ID--"+id);
        redisClient.get(id, function(err, reply) {console.log("redis reply.doc");console.log(reply);
        if (err) console.log('error: ' + err);
        var tempJSONServerState = JSON.parse(reply);console.log("redis response");console.log('initial redis reply: '+ reply);
        serverState.cloneJSON(tempJSONServerState);

        //append to the current serverstate
        console.log('server state: ' + serverState);
        serverState.appendChangeset(inputChangeSet,clientNumber,clientsKnownPosition);
        confirmation(serverState.revisionHistory.length - 1);

        //send updated changeset to all remaining clients
        var socketList = io.sockets.server.eio.clients;
        for(var i = 0; i < serverState.clientSocketID.length; i++){
            if (socketList[serverState.clientSocketID[i]] != undefined && i != clientNumber){
                var initialPosition = serverState.clientPos[i] + 1;
                var outgoingChangeset = serverState.sendChangeset(initialPosition,i);
                var socketText = serverState.clientSocketID[i];
                
                io.to(socketText).emit('changesetFromServer', outgoingChangeset[0], outgoingChangeset[1]
                );
                serverState.clientPos[i] = serverState.revisionHistory.length - 1; 
            }
        }
    //put back into redis
    redisClient.set(serverState.id, JSON.stringify(serverState), function (err, reply) {
        if (err) {
          console.log(err);
            console.log(reply);
        }
        else{
          console.log('after written back in' +JSON.stringify(serverState));
        };
    });
    });
});
});

//routing function to redirect to login page
router.get('/login', function(request, response) {
    response.sendFile(path.join(__dirname + '/client/login.html'));
});

//routing function to add session when user login
router.post('/auth', function(request, response) {
    var username = request.body.username;
    var password = request.body.password;
    if (username && password) {

        dataBase.logIn(username, password, function(response) {
            if(response =='error'){
                response.send('Please enter Username and Password!');
                response.end();
            }
            else{
                 // sets a cookie with the user's info
                 request.session.username = username;
                 //console.log("sessionId--"+request.sessionID);
                 request.session.save();
                 console.log(response);
            }
        });
        
        
        response.redirect('/home');
        response.end();
    } else {
        response.send('Please enter Username and Password!');
        response.end();
    }

});

//routing to home page
router.get('/home', function(request, response) {
    if (request.session && request.session.username) {
        response.sendFile(path.join(__dirname + '/client/index.html'));
    }else
        response.redirect('/login');
});

//funtion to get notes specific to the user
router.get('/get/notes',function(req,res){
    if (req.session && req.session.username) {//console.log(req.session);
    // lookup the user in the DB by pulling their username from the session
    dataBase.getNoteIds(req.session.username, function(response) {
        if(response){
            //parse response multiple noteids
            dataBase.findNoteName(response, function(title) {
                var paddetails = [];
                paddetails[0] = {'Id':response,'Name':title};
                res.send(paddetails);
            });
        }
    });
  
    }
});

//logout
router.get('/logout', function(req, res) {
    req.session.destroy((error)=>{
        if(error){
            console.log(error);
        }
    });
    res.redirect('/login');
});

//get note details
router.get('/note/:id', function(req, res) {
    if (req.session && req.session.username) {
        res.sendFile(path.join(__dirname + '/client/note.html'), {'noteid': req.params.id});
    }else
        res.redirect('/login');
});

//creating note
router.post('/createnote', function(req, res) {
    if (req.session && req.session.username) {
        //create new notepad get id //
        dataBase.createNotebook(req.body.title, function(response) {
            var noteID = response;
            if(noteID){
                //add the notepadID to  user details 
                dataBase.addSharedNotebook(req.session.username, noteID, function(response) {
                    //added successfully to user
                    res.send({ noteid: noteID });
                });
            }
        });
    }else
        res.redirect('/login');
});

//sharing note
router.post('/sharenote', function(req, res) {
    if (req.session && req.session.username) {
        //validation should be added if usernames exist
        var usernames = req.body.sharewith;
        var noteId = req.body.noteid;
        if(usernames.indexOf(",") !=undefined && usernames.indexOf(",")>0){ //more than 1 shared person
            var ausernames = usernames.split(",");
            for(var i=0;i<ausernames.length;i++){
                dataBase.addSharedNotebook(ausernames[i], noteId,  function(response) {
                    //added successfully to user(not handling error)
                    
                });res.send({ msg:"success"});
            }
        }else{
             dataBase.addSharedNotebook(usernames, noteId,  function(response) {
                    //added successfully to user(not handling error)
                    res.send({ msg:"success"});
             });
        }
    }else
        res.redirect('/login');
});

//register 
router.get('/register', function(request, response) {
    response.sendFile(path.join(__dirname + '/client/register.html'));
});

//check if register name is already used else return to home page
router.post('/authregister', function(request, res) {
    var username = request.body.username;
    var password = request.body.password;
    if (username && password) {
        // lookup if username already used
        dataBase.getNoteIds(username, function(response) {
            if(response =='new user'){
                dataBase.insertUser(username, password, function(response){
                    console.log(response);
                    //return to home page after successfull registration
                    res.redirect('/login?e=' + encodeURIComponent('registered'))
                });
            }else{
                //return saying duplicate
                res.redirect('/register?e=' + encodeURIComponent('usernameexists'))
                res.end(); 
            }
        });
        
    } else {
        res.send('Please enter Username and Password!');
        res.end();
    }

});
//lisening to port 3000
server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("Chat server listening at", addr.address + ":" + addr.port);
});

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
          newCharBank += externalCharBank.slice(externalCharBankPos, externalCharBankPos + externalRemaining);
          externalCharBankPos += externalRemaining;
          externalRemaining = 0;
        }
        //local insertions overwrite external retains
        else if(localOperation === '+' && localRemaining > 0){
          if(localRemaining >= externalRemaining){
            if(externalRemaining > 0){
              newInstructionList.push('+' + externalRemaining.toString());
              newCharBank += localCharBank.slice(localCharBankPos, localCharBankPos + externalRemaining);
              localCharBankPos += externalRemaining;
              localRemaining -= externalRemaining;
              externalRemaining = 0;
            }
            else{
              newInstructionList.push('+' + localRemaining.toString());
              newCharBank += localCharBank.slice(localCharBankPos, localCharBankPos + localRemaining);
              localCharBankPos += localRemaining;
              localRemaining = 0;
            }
          }
          else if(externalRemaining > localRemaining){
            newInstructionList.push('+' + localRemaining.toString());
            newCharBank += localCharBank.slice(localCharBankPos, localCharBankPos + localRemaining);
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
      i++;
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
    //var newText = $("notepad").val();
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
    message = beforeAndAfterLengths(oldLength,newLength) + message;
    message += '$' + charBank;

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
  function beforeAndAfterLengths(oldLength,newLength){
    var diff = newLength - oldLength;

    if(diff >= 0){
      return ":" + oldLength.toString() + '>' + diff.toString();
    }
    else{
      return ":" + oldLength.toString() + '<' + Math.abs(diff.toString());
    }
  }

//ServerDoc Class
//Object that is responsible for maintaining the state of the document on the server
//Each instance corresponds to a single note
class ServerDoc {
  //empty constructor
    constructor(){
        this.id = '';
        this.name = '';
        this.initialState = '';
        this.revisionHistory = [];
        this.clientPos = [];
        this.clientSocketID = [];
        this.revisionAuthors = [];
    }
    
    //Clones a JSON object as a ServerDoc object
    //Accepts a JSON object as input, expects it to be a ServerDoc object that had previously been written as a JSON 
    cloneJSON(input){
        this.id = input.id;
        this.name = input.name;
        this.initialState = input.initialState;
        this.revisionHistory = input.revisionHistory;
        this.clientPos = input.clientPos;
        this.clientSocketID = input.clientSocketID;
        this.revisionAuthors = input.revisionAuthors;  
    }
     
    
    //gets the socket.io ID of the current client
    getClientNum(socketID){
        for(var i = 0; i < this.clientSocketID.length; i++){
            if(this.clientSocketID[i] === socketID){
                return i;
            }
        }
    }
    
    //The identity function returns the changeset that would leave the current state of the document as is if applied
    //Returns the format :<textLength>>0=<textLength>$
    identity(){
      var serverLength = this.initialState.length.toString();
      return ':' + serverLength + '>0=' + serverLength + '$';
    }
    
    //Appends an input changeset to the top position of revision history
    //inputChangeset must be transformed from the client position to be relative to current top item in revision history
    appendChangeset(inputChangeSet, clientNumber, clientsKnownPosition){
      console.log('inputset: ' + inputChangeSet);
      console.log('clientNum: ' + clientNumber);
      console.log('clientPos: ' + clientsKnownPosition);
      clientsKnownPosition++;  
      
        if(clientsKnownPosition != this.revisionHistory.length){
            inputChangeSet = this.transformChangeSet(inputChangeSet, clientNumber, clientsKnownPosition);
        }

        this.revisionHistory.push(inputChangeSet);
        this.revisionAuthors.push(clientNumber);
        this.clientPos[clientNumber] = this.revisionHistory.length - 1;

        return true;
    }

    //transforms the changeset into form that can be appended to current state of server
    transformChangeSet(transformedChangeSet, clientNum){
        //starting one beyond the location the client is currently at
        var targetPos = this.clientPos[clientNum];
        
        do {
            transformedChangeSet = following(this.revisionHistory[targetPos], transformedChangeSet);
            targetPos++;
        } while (targetPos < this.revisionHistory.length);

        return transformedChangeSet;
    }
    
    //Combines changesets from requested position until end of revision history
    //also increments the clientNumber
    sendChangeset(requestedPosition, clientNumber){
      if(requestedPosition >= this.revisionHistory.length && this.revisionAuthors[requestedPosition] != clientNumber){
        return [this.revisionHistory.length - 1,false];
      }

      this.clientPos[clientNumber] = requestedPosition;
      var outgoingChangeset = this.revisionHistory[requestedPosition]
      requestedPosition++;
      while(requestedPosition < this.revisionHistory.length){
        if(this.revisionAuthors[requestedPosition] != clientNumber){
          outgoingChangeset = combineChangesets(outgoingChangeset, this.revisionHistory[requestedPosition]);
        }
        requestedPosition++;
      }
      requestedPosition--;  //must decrement one to move back to current max index
      return [requestedPosition, outgoingChangeset];
    }
    
    //Combines changesets from requested position until end of revision history
    combineAllChangesets(requestedPosition){
      if(requestedPosition >= this.revisionHistory.length){
        return false;
      }

      var outgoingChangeset = this.revisionHistory[requestedPosition]
      requestedPosition++;
      while(requestedPosition < this.revisionHistory.length){
        outgoingChangeset = combineChangesets(outgoingChangeset, this.revisionHistory[requestedPosition]);
        requestedPosition++;
      }
      return outgoingChangeset;
    }
    
    
    //Combines all changesets form the starting posotion to the end of revision history
    sendDocumentState(){
        var document = this.revisionHistory[0];

        for(var index = 1; index < this.revisionHistory.length; index++){
            document = merge(document, this.revisionHistory[index]);
        }

        return document;
    }
}
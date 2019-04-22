//Mongo DB test app

//require modules
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
// Database Name
const dbName = 'myproject';
  

//--------------------------------------------------
//Connect to Mongo DB and perform some actions - only function not exposed as it is used internally
//--------------------------------------------------
function connectDB(callback){
  // Connection URL
  console.log(process.env.IP);
  const url = 'mongodb://' + process.env.IP + ':27017';
  
  // Use connect method to connect to the server
  MongoClient.connect(url, function(err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");
  
    //const db = client.db(dbName);
    callback(client);
  });
}

//This exposes modules to other code which include dataBase.js.  In this case it will expose these funtions to server.js
module.exports = {

//--------------------------------------------------
//User Login -- working
//--------------------------------------------------
logIn: function (uname, pword, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    //find users with username and password
    var query = { username: uname, password: pword };
    db.collection("users").find(query).toArray(function(err, docs){
      if(err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback("error");
          //callback(err);
        });
      }
      else {
        client.close(function (response){
          console.log(docs[0].notebooks);
          callback(docs[0].notebooks);
        });
      }
    })
  });
},

//--------------------------------------------------
//Get Note IDs with username also used for checking during registering time if username exists - working
//--------------------------------------------------
getNoteIds: function (uname, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    //find users with username and password
    var query = { username: uname};
    db.collection("users").find(query).toArray(function(err, docs){
      if(err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback("error");
          //callback(err);
        });
      }
      else {
        client.close(function (response){console.log(docs);
          if(docs.length)
          {
            console.log(docs[0].notebooks);
            callback(docs[0].notebooks);
          }else{//no record
            callback("new user");
          }
        });
      }
    })
  });
},
//--------------------------------------------------
//Insert new user -- working
//--------------------------------------------------
insertUser: function (uname, pword, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
     // Get the user collection
    const collection = db.collection('users');
    // Insert new user
    //notebook ID 0 is reserved for no shared notebooks at the moment
    var newUser = { username: uname, password: pword, notebooks: "0" };
    collection.insertOne(newUser, function(err, result) {
      if(err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){
          console.log("Success: " + result);
          callback("Success");
        });
      }
    })
  });
},
//--------------------------------------------------
//Add shared notebook to username -- working
//--------------------------------------------------
addSharedNotebook: function (uname, noteID, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
     // Get the user collection
    const collection = db.collection('users');
     // Update document where username is uname, set notebooks equal to noteID
    collection.updateOne({ username : uname }
    , { $set: { notebooks : noteID } }, function(err, result) {
      if(err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){
          console.log("Success: " + result);
          callback("Success");
        });
      }
    });
  });
},
//--------------------------------------------------
//Create new notebook -- working
//Each new notebook will be created as a new collection in MongoDB.  We could have made all notebook updates, no
//matter the notebook to the same collection.  This may be cleaner but there appeares to be a 24000 limit on the 
//number of collections.  This could be improved in later iterations.
//This function should be refactored in later updates to split into seperate functions and make it cleaner
//--------------------------------------------------
createNotebook: function (noteName, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    //get the next available note ID - this could be improved in future iterations to move 
    //from simple iterative IDs to a method where it is easier to account for deleted notes
    const collection = db.collection('admin');
    var nextNoteID = 0;
    collection.find({}).toArray(function(err, docs) {
      if(err) {
        client.close(function (response){
          console.log("Error finding ID: " + err);
          callback(err);
        });
      }
      else {
        console.log("found next note ID");
        console.log(docs[0].nextID);
        nextNoteID = docs[0].nextID;
        // Create new collection
        var collectionName = "note_" + nextNoteID;
        db.createCollection(collectionName, function(err, result) {
          if(err) {
            client.close(function (response){
              console.log("Error creating new collection: " + err);
              callback(err);
            });
          }
          else {
            console.log("Successfully created new collection: note_" + nextNoteID);
            //Update the next notepad ID in admin table
            var updatedNoteID = nextNoteID + 1;
            collection.updateOne({ nextID : nextNoteID }
            , { $set: { nextID : updatedNoteID } }, function(err, result) {
              if(err) {
                client.close(function (response){
                  console.log("Error: " + err);
                  callback(err);
                });
              }
              else {
                console.log("Updated NextNote ID: " + updatedNoteID);
                db.collection("note_" + nextNoteID).insertOne({name: noteName}, function(err, result) {
                  if (err) {
                    client.close(function (response){
                      console.log("Error: " + err);
                      callback(err);
                    });
                  }
                  else {
                    client.close(function (response){
                      console.log("Successfully updated note name.  Finished: " + result);
                      callback(nextNoteID);
                    });
                  }
                });
              }
            });
          }
        });
      }
    })
  });
},
//--------------------------------------------------
//Find the name of a notebook -- working
//--------------------------------------------------
findNoteName: function (notebookID, callback) {
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
     // Get the user collection
    db.collection("note_" + notebookID).findOne({}, function(err, result) {
      if(err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){
          if(result !=null){
            console.log(result.name);
            callback(result.name);
          }else callback("");
        });
      }
    })
  });
},
//--------------------------------------------------
//Insert HEAD text to note_id collection -- working
//--------------------------------------------------
insertHead: function (noteID, text, callback) {
  
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    // Insert HEAD with latest full text
    const collection = db.collection("note_" + noteID); 
    db.collection("note_" + noteID).insertOne({type: "HEAD", noteText: text}, function(err, result) {
      if (err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){
          console.log("Successfully inserted HEAD: " + result);
          callback("Success");
        });
      }
    });
     
  });
},
//--------------------------------------------------
//Insert checkpoint to note_id collection -- working
//--------------------------------------------------
pushCheckpoint: function (noteID, mod, callback) {
  
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    // Insert checkpoint
    const collection = db.collection("note_" + noteID); 
    db.collection("note_" + noteID).insertOne({type: "MOD", modification: mod}, function(err, result) {
      if (err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){
          console.log("Successfully inserted modification: " + result);
          callback("Success");
        });
      }
    });
  });
},
//--------------------------------------------------
//Pull latest HEAD text for note_id  -- working
//--------------------------------------------------
pullHead: function (noteID, callback) {
  
  //connect to DB and wait for callback of connection
  connectDB(function(client) {
    //once connected
    const db = client.db(dbName);
    // Insert HEAD with latest full text
    const collection = db.collection("note_" + noteID); 
    var query = { type: "HEAD" };
    db.collection("note_" + noteID).find(query).sort({_id:1}).toArray(function(err, docs){
      if (err) {
        client.close(function (response){
          console.log("Error: " + err);
          callback(err);
        });
      }
      else {
        client.close(function (response){console.log(docs);
          if(docs.length){
            console.log(docs[docs.length - 1].noteText);
            callback(docs[docs.length - 1].noteText);
          }else{
            callback("");
          }
        });
      }
    });
     
  });
}
//end of exports
}

//--------------------------------------------------
//Update documents - could be used at a later update
//--------------------------------------------------
const updateDocument = function(db, callback) {
  // Get the documents collection
  const collection = db.collection('documents');
  // Update document where a is 2, set b equal to 1
  collection.updateOne({ a : 2 }
    , { $set: { b : 1 } }, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    console.log("Updated the document with the field a equal to 2");
    callback(result);
  });
}

//--------------------------------------------------
//Remove documents - could be used at a later update
//--------------------------------------------------
const removeDocument = function(db, callback) {
  // Get the documents collection
  const collection = db.collection('documents');
  // Delete document where a is 3
  collection.deleteOne({ a : 3 }, function(err, result) {
    assert.equal(err, null);
    assert.equal(1, result.result.n);
    console.log("Removed the document with the field a equal to 3");
    callback(result);
  });
}

//--------------------------------------------------
//Index collection - could be used at a later update
//--------------------------------------------------
const indexCollection = function(db, callback) {
  db.collection('documents').createIndex(
    { "a": 1 },
      function(err, results) {
        console.log(results);
        callback();
    }
  );
};
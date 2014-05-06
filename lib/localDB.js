/**
 * Created by Koustuv Sinha & Hitesh Agarwal on 7/4/14.
 */

'use strict';
var queue = require('./queue')();
var _ = require('./lodash');
var EventEmitter = require('./events').EventEmitter;
var remote = require('./remote')('offline_mongo','9ZhT-BicRCFXZl-I9dtRqWfKOkAOZt2f');
var async = require('./async');

module.exports = function() {

    var self = new EventEmitter();
    var localSave = {};
    localSave.indexedDB = {};


    //------------------------indexedDB local save functions--------------------------

    localSave.indexedDB.db = null;
    localSave.indexedDB.open = function(db_name,version,callback) {
        var request = indexedDB.open(db_name,version);

        request.onupgradeneeded = function(e) {
            var db = e.target.result;

            e.target.result.onerror = localSave.indexedDB.onerror;
            if(db.objectStoreNames.contains(db_name)) {
                db.deleteObjectStore(db_name);
            }
            db.createObjectStore(db_name,{keyPath : "_id"});
            console.log("request.onupgradeneeded - localSave");
        };


        request.onsuccess = function(e) {
            localSave.indexedDB.db = e.target.result;
            console.log("request.onsuccess - localSave");
            callback(true);
        };

        request.onerror = function(e) {
            console.log("Error At IndexedDB open");
            callback(false);
        }
    };

    localSave.indexedDB.close = function() {
        var db = localSave.indexedDB.db;
        console.log("DB Closing!");
        db.close();
    }

    localSave.indexedDB.addItem = function(db_name,data,callback) {
        var db = localSave.indexedDB.db;
        var trans = db.transaction([db_name],"readwrite");
        var store = trans.objectStore(db_name);
        var request = store.put(data);
        request.onsuccess = function(e) {
            console.log("added data");
            callback(true);
        };
        request.onerrror = function(e) {
            console.log(e.value);
            callback(true);
        };
    };

    localSave.indexedDB.hasItem = function(db_name,key,callback) {
        var db = localSave.indexedDB.db;
        var trans = db.transaction([db_name],"readwrite");
        var store = trans.objectStore(db_name);
        var ob = store.get(key);
        console.log("db_name " + db_name + ", key = " + key);
        ob.onsuccess = function(e) {
            var result = e.target.result;
            if(result) {
                console.log("Data Present! " + JSON.stringify(result));
                callback(true,result);

            }else{
                console.log("No data found!");
                callback(false,null);
            }
        }
        ob.onerror = function(e) {
            console.log("No data found!");
            callback(false);
        }
    }

    localSave.indexedDB.removeItem = function(db_name,key,callback) {
        var db = localSave.indexedDB.db;
        var trans = db.transaction([db_name],"readwrite");
        var store = trans.objectStore(db_name);
        var request = store.delete(key);
        request.onsuccess = function(e) {
            console.log("Deleted data");
            callback(true);
        };
        request.onerrror = function(e) {
            console.log(e.value);
            callback(true);
        };
    }



    //initialize the db, if any change in structure needed change the vesrion number

    function init(name,callback) {
        localSave.indexedDB.open(name,9,function() {
            console.log("localSave opened!");
            callback();
        });


    }

    //add data to indexedDB

    function addData(db_name,json) {
        init(db_name,function() {
            addID(json,function(status) {
                localSave.indexedDB.addItem(db_name,json,function(st) {
                    if(st) {
                        queue.addQueue(db_name,json,"insert",function(status) {
                            if(status) {
                                console.log("Data Added to LocalDB and Queue");
                                console.log("Data : " + JSON.stringify(json));
                                localSave.indexedDB.close();
                            }
                        })
                    }
                })
            });

        });

    }

    function getData(query) {
        var result = localSave.indexedDB.getItem(query);
        console.log(result);
    }

    function sync(callback) {
        console.log("Queue Syncing Starts " + new Date().getTime());
        queue.init(function(status,mesg) {
            if(status) {
                console.log("RemoteDB Syncing Starts " + new Date().getTime());
                remote.readAll(function(data,status) {
                    if(status) {
                        console.log(data);
                        //read one by one from document, search indexeddb for that document to be present, if not present insert it
                        //also, if present, check whether it has been updated or not

                        async.forEach(data,function(collection,cb) {
                            if(collection !== "system.indexes" && collection !== "system.users") {
                                console.log("Reading Collection " + collection);
                                remote.read(collection,function(msg,status) {
                                    if(status) {
                                        console.log("Data returned from collection " + collection + " are " + JSON.stringify(msg));
                                        if(!_.isEmpty(msg)) {
                                            operate(collection,msg,function(st) {
                                                console.log('Operate Done, proceeding to next ' + st);
                                                cb();
                                            })
                                        }else{
                                            cb();
                                        }
                                    }
                                })
                            }else{
                                cb();
                            }
                        },function(err) {
                            console.log('Syncing END at ' + new Date().getTime());
                            callback(true,mesg);
                        });


                    }else{
                        callback(false,mesg);
                    }

                })
                }else {
                callback(false,mesg);
            }
        });




    }

    //check synced data and insert or update or delete

    function operate(collection,data,callback) {
        async.forEach(data,function(record,cb) {
            console.log("Searching for Record " + JSON.stringify(record) + " in " + collection);
            init(collection,function() {
                localSave.indexedDB.hasItem(collection,record._id,function(status,result) {
                    console.log("Found Status : " + status);
                    //localSave.indexedDB.close();
                    if(!status) {
                        //not present in indexedDB, so insert!
                        //first check of deleted data
                        if(!_.has(record,"deleted")) {
                            localSave.indexedDB.addItem(collection,record,function(st) {
                                if(st) {
                                    console.log("Data Synced from Remote!");
                                    cb();
                                }
                            })
                        }else{
                            cb();
                        }

                    }
                    else{
                        //present in indexeddb
                        //check if the data is not updated, also check for deleted data, also check for conflicts
                        if(!_.has(record,"deleted")) {
                            if(!_.isEqual(record,result)) {
                                checkConflict(record,function(st) {
                                    if(!st) {
                                        localSave.indexedDB.addItem(collection,record,function(st) {
                                            if(st) {
                                                console.log("Data Updated! "+ JSON.stringify(record));
                                                cb();
                                            }
                                        })
                                    }
                                    else{
                                        console.warn("Conflicted Data, cannot update unless user clears conflict!");
                                        cb();
                                    }
                                })

                            }else{
                                cb();
                            }
                        }else{
                            localSave.indexedDB.removeItem(collection,record._id,function(st) {
                                if(st) {
                                    console.log("Data " + JSON.stringify(record) + " deleted from local db");
                                    cb();
                                }
                            })
                        }

                    }
                });
            });


        },function(err) {
             callback(true);
        })
    }

    //check for conflicts before local indexed db updation

    function checkConflict(record,callback) {
        queue.getConflicts(function(st,data) {
            if(st) {
                var found = false;
                data.forEach(function(entry) {
                    if(entry.data._id == record._id) {
                        found = true;
                    }
                })
                callback(found);
            }
            else{
                callback(false);
            }
        })
    }

    //resolve conflicts
    //action true : revert to prev update
    //action false : put your update

    function resolveConflict(id,action,callback) {
        queue.getConflicts(function(st,data) {
            var conflict = _.filter(data,{"timeStamp" : id});
            conflict = conflict[0];
            if(!_.isEmpty(conflict)&& _.isObject(conflict)) {
                if(action) {
                    //reverting to prev update --- no change in server necessary, just update the local db
                    init(conflict.document,function() {
                        localSave.indexedDB.addItem(conflict.document,conflict.old,function(st1) {
                            if(st1) {
                                console.log("Prev Data updated in local indexedDB!");
                                queue.resolveConflict(conflict.timeStamp,function(st) {
                                    if(st) {
                                        console.log("Conflict Resolved from Queue at " + new Date().getTime());
                                        callback(true);
                                    }
                                })
                            }
                        });
                    });

                }else{
                    //put your update in server finally
                    queue.addQueue(conflict.document,conflict.data,"force_update",function(st) {
                        console.log("Data Updated by local copy as per user choice!");
                        queue.resolveConflict(conflict.timeStamp,function(st) {
                            if(st) {
                                console.log("Conflict Resolved from Queue at " + new Date().getTime());
                                callback(true);
                            }
                        })
                    })
                }
            }else{
                callback(false);
            }
        });

    }

    //get conflicts-------- returns data in the format of array of objects : { "document" : document,
    // "action" : "conflict", "data" : your update, "old" : conflict update, "timeStamp" : id }


    function getAllConflicts(callback) {
        queue.getConflicts(function(st,data) {
            callback(st,data);
        })
    }

    //generate MongoDB ID and add it to every document

    function addID(data,callback) {
        if(!_.has(data,"_id")) {
            var obj = new ObjectId();
            _.extend(data,{"_id" : obj.toString()});
            callback(true);
        }
        else callback(false);
    }

    //find document by query -- returns array of results for non _id query

    function findData(collection,query,callback) {
        if(_.isObject(query)) {
            init(collection,function() {
                var db = localSave.indexedDB.db;
                var trans = db.transaction([collection]);
                var store = trans.objectStore(collection);
                if(_.has(query,"_id")) {
                    var req = store.get(query._id);
                    req.onsuccess = function(e) {
                        var result = e.target.result;
                        if(result) {
                            console.log("Record found for query " + JSON.stringify(query));
                            callback(true,result);
                        }
                        else{
                            console.log("No Record found for query " + JSON.stringify(query));
                            callback(false,{});
                        }
                    }
                    req.onerror = function(e) {
                        callback(false, e.target.error);
                    }
                }
                else{
                    var data = [];
                    var keyRange = IDBKeyRange.lowerBound(0);
                    var cursorRequest = store.openCursor(keyRange);
                    cursorRequest.onsuccess = function(e) {
                        var result = e.target.result;
                        if(!!result == false) {
                            var search = "";
                            if(_.has(query,"all")) search = data;
                            else search = _.filter(data,query);
                            if(!_.isEmpty(search)) {
                                console.log("Record(s) found for query " + JSON.stringify(query));
                                callback(true,search);
                            }
                            else{
                                console.log("No Record(s) found for query " + JSON.stringify(query));
                                callback(false,{});
                            }
                        }
                        if(result!==null) {
                        var record = result.value;
                        data.push(record);
                        result.continue();
                        }
                    }
                    cursorRequest.onerror = function() {
                        console.log("Error occurred at cursor retrieval");
                        callback(false,{});
                    }
                }

            })
        }
    }

    //update a document with a given where clause

    function updateData(collection,record,where,callback) {
        var defaults = _.partialRight(_.assign, function(a, b) {
            return typeof a == 'undefined' ? b : a;
        });
        if(_.isObject(record)&& _.isObject(where)) {
            findData(collection,where,function(status,result) {
                if(status) {

                    if(_.isArray(result)) {
                      console.log("isArray");
                      result.forEach(function(old) {
                          var new_record = record;
                          defaults(new_record,old);
                          console.log("Updated Value :");
                          console.log(new_record);
                          updateIndexedDB(collection,new_record,function(st) {
                              if(st) {
                                 console.log("Data Updated Successfully!");
                              }
                          })

                      })
                      callback(true);

                    }
                    else {
                        console.log("isObject");
                        var new_record = record;
                        defaults(new_record,result);
                        console.log("Updated Value :");
                        console.log(new_record);
                        updateIndexedDB(collection,new_record,function(st) {
                            if(st) {
                                console.log("Data Updated Successfully!");
                            }
                        })
                        callback(true);
                    }
                }
                else{
                    callback(false);
                }
            })
        }
    }

    function updateIndexedDB(db_name,json,callback) {
        init(db_name,function() {
            localSave.indexedDB.addItem(db_name,json,function(st) {
                if(st) {
                    queue.addQueue(db_name,json,"update",function(status) {
                        if(status) {
                            console.log("Data Updated to LocalDB and Queue");
                            console.log("Data : " + JSON.stringify(json));
                            localSave.indexedDB.close();
                            callback(true);
                        }
                    })
                }
            })
        })
    }


    //deletes data from local IndexedDB

    function deleteData(collection,where,callback) {
        if(_.isObject(where)) {
            findData(collection,where,function(status,result) {
              if(status) {
                  if(_.isArray(result)) {
                      console.log("isArray");
                      result.forEach(function(record) {
                          localSave.indexedDB.removeItem(collection,record._id,function(st) {
                              if(st) {
                                  queue.addQueue(collection,record,"delete",function(res) {
                                      if(res) {
                                          console.log("Data removed from Local DB");
                                      }
                                  })
                              }
                          })


                      })
                      callback(true);

                  }
                  else {
                      console.log("isObject");

                      localSave.indexedDB.removeItem(collection,result._id,function(st) {
                          if(st) {
                              queue.addQueue(collection,result,"delete",function(res) {
                                  if(res) {
                                      console.log("Data removed from Local DB");
                                  }
                              })
                          }
                      })

                      callback(true);
                  }
              }  else {
                  console.log("Data not found, so not deleted");
                  callback(false);
              }
            })
        }
    }

    _.extend(self, {
        init : init,
        addData : addData,
        getData : getData,
        sync : sync,
        addID : addID,
        findData : findData,
        updateData : updateData,
        deleteData : deleteData,
        getAllConflicts : getAllConflicts,
        resolveConflict : resolveConflict
    })

    return self;

}
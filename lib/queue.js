/**
 * Created by Koustuv Sinha & Hitesh Agarwal on 15/4/14.
 */

var _ = require('./lodash');
var EventEmitter = require('./events').EventEmitter;
var async = require('./async');
var remoteDB = require('./remote')('offline_mongo','9ZhT-BicRCFXZl-I9dtRqWfKOkAOZt2f');

module.exports = function() {
    var localQueue = {};
    localQueue.indexedDB = {};
    var self = new EventEmitter();

    var testdb = null;

    //var status = false;

    localQueue.indexedDB.db = null;
    localQueue.indexedDB.resultArray = [];
    var QueueDB = "LocalQueue";


    localQueue.indexedDB.open = function(callback) {
        //var version = 8;
        var request = indexedDB.open(QueueDB);
        request.onupgradeneeded = function(e) {
            var db = e.target.result;

            e.target.result.onerror = localQueue.indexedDB.onerror;
            if(!db.objectStoreNames.contains(QueueDB)) {
                db.createObjectStore(QueueDB,{ keyPath : "timeStamp"});
            }

            console.log("request.onupgradeneeded");
        };

        request.onsuccess = function(e) {
            localQueue.indexedDB.db = e.target.result;
            testdb = e.target.result;
            console.log("within onsuccess, db - " + localQueue.indexedDB.db);
            console.log("request.onsuccess");
            callback(true);
        };

        request.onerror = localQueue.indexedDB.onerror;
    };

    localQueue.indexedDB.addQueue = function(document,data,action,callback) {
        var db = localQueue.indexedDB.db;
        var trans = db.transaction([QueueDB],"readwrite");
        var store = trans.objectStore(QueueDB);
        var request = store.put({
            "document" : document,
            "action" : action,
            "data" : data,
            "timeStamp" : new Date().getTime()
        });
        request.onsuccess = function(e) {
            console.log("Queue Added");
            callback(true);
        };
        request.onerrror = function(e) {
            console.log(e.value);
            callback(false);
        };
    };

    localQueue.indexedDB.addConflict = function(data,newrecord,callback) {
        var db = localQueue.indexedDB.db;
        var trans = db.transaction([QueueDB],"readwrite");
        var store = trans.objectStore(QueueDB);
        var request = store.put({
            "document" : data.document,
            "action" : "conflict",
            "data" : data.data,
            "old" : newrecord,
            "timeStamp" : new Date().getTime()
        });
        request.onsuccess = function(e) {
            console.log("Conflict Added");
            callback(true);
        };
        request.onerrror = function(e) {
            console.log(e.value);
            callback(false);
        };
    };

    localQueue.indexedDB.getQueue = function(callback) {
        var db = localQueue.indexedDB.db;
        var trans = db.transaction([QueueDB],"readwrite");
        var store = trans.objectStore(QueueDB);
        var keyRange = IDBKeyRange.lowerBound(0);
        var cursorRequest = store.openCursor(keyRange);

        var resultArray = [];

        cursorRequest.onsuccess = function(e) {
            var ct = 0;
            var result = e.target.result;
            if(!!result == false) {
                //we have the queue result, now call other methods from here

                console.log(JSON.stringify(resultArray));
 //               execute(resultArray);
                console.log("Reading complete, exiting..." + new Date().getTime());
                callback({"action" : "done"});
                return;
            }

  //          resultArray.push(result.value);
            console.log("retrieved -- " + JSON.stringify(result.value));
            console.log("retrieved .. " + new Date().getTime());

            callback(result.value);

            result.continue();
        };


        cursorRequest.onerror = localQueue.indexedDB.onerror;
    }

    localQueue.indexedDB.getConflict = function(callback) {
        var db = localQueue.indexedDB.db;
        var trans = db.transaction([QueueDB],"readwrite");
        var store = trans.objectStore(QueueDB);
        var keyRange = IDBKeyRange.lowerBound(0);
        var cursorRequest = store.openCursor(keyRange);

        var resultArray = [];

        cursorRequest.onsuccess = function(e) {
            var ct = 0;
            var result = e.target.result;
            if(!!result == false) {
                console.log("Conflict Reading complete, exiting..." + new Date().getTime());
                callback(resultArray);
                return;
            }

            if(result.value.action == "conflict") {
                resultArray.push(result.value);
            }

            result.continue();
        };


        cursorRequest.onerror = localQueue.indexedDB.onerror;
    }

    localQueue.indexedDB.deleteQueue = function(id,callback) {
        var db = localQueue.indexedDB.db;
        var trans = db.transaction([QueueDB],"readwrite");
        var store = trans.objectStore(QueueDB);
        var request = store.delete(id);

        request.onsuccess = function(e) {
            console.log("Deleted Queue Item");
            callback(true);
        }
        request.onerror = function(e) {
            console.log(e);
            callback(false);
        }
    }

    localQueue.indexedDB.close = function() {
        var db = localQueue.indexedDB.db;
        console.log("DB Closing");
        db.close();
    }




    function init(callback) {
        self.emit('init');
        localQueue.indexedDB.open(function(status) {
            if(status) {
                processQueue(function(st,msg) {
                    callback(st,msg);
                });

            }
        });
    }

    function processQueue(callback) {
        var defaults = _.partialRight(_.assign, function(a, b) {
            return typeof a == 'undefined' ? b : a;
        });
        console.log(localQueue.indexedDB.db);
        if(doesConnectionExist()) {
            console.log("retrieving .."+new Date().getTime());
            localQueue.indexedDB.getQueue(function(data) {
                console.log(data);
                switch(data.action) {
                    case "insert" : remoteDB.insert(data.document,data.data,function(status) {
                        console.log("Status : " + status);
                        if(status) {
                            console.log("Data inserted at " + new Date().getTime());
                            localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                console.log(status);
                                callback(true,null);
                            })
                        }else{
                            callback(false,null);
                        }

                    })
                        break;
                    //to resolve update anomaly
                    case "update" :
                        remoteDB.readOne(data.document,data.data._id,function(rec,st) {
                            if(st) {
                                console.log("Retrieved single doc " + rec);

                                if(data.data.timeStamp != rec.timeStamp) {
                                    //timeStamp of the updated doc is not equal to the timestamp of the doc in server,
                                    // which implies update anomaly
                                    console.warn("WARN : FLAGGED UPDATE ANOMALY, Logging into database...");
                                    //var updatedDoc = data.data;
                                    //defaults(updatedDoc,rec);
                                    //console.log("Updated doc " + JSON.stringify(updatedDoc));
                                    //maintain output log
                                    //save it in queue itself with action="conflict"

                                    localQueue.indexedDB.addConflict(data,rec,function(status) {
                                        if(status) {
                                            console.log("Conflict Data logged at " + new Date().getTime());
                                            //delete from queue
                                            localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                                console.log(status);
                                                callback(true,{"conflict" : "yes"});
                                            })
                                        }
                                        else{
                                            callback(false,null);
                                        }
                                    });
                                }else {
                                    //no anomaly
                                    remoteDB.update(data.document,data.data,function(status) {
                                        if(status) {
                                            console.log("Data updated at " + new Date().getTime());
                                            localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                                console.log(status);
                                                callback(true,null);
                                            })
                                        }
                                        else{
                                            callback(false,null);
                                        }
                                    });
                                }
                            }else{
                                callback(false,null);
                            }
                        });

                        /*
                        */
                        break;
                    //force update on conflict resolving...
                    case "force_update" : remoteDB.update(data.document,data.data,function(status) {
                            if(status) {
                                console.log("Data force updated at " + new Date().getTime());
                                localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                    console.log(status);
                                    callback(true);
                                })
                            }
                            else{
                                callback(false);
                            }
                        });
                        break;
                    case "delete" : remoteDB.remove(data.document,data.data,function(status) {
                        if(status) {
                            console.log("Data Deleted at " + new Date().getTime());
                            localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                console.log(status);
                                callback(true,null);
                            })
                        }
                        else{
                            callback(false,null);
                        }
                    })
                        break;
                    case "done" : callback(true,null);
                        break;
                    case "conflict" : callback(true,{"conflict" : "yes"});
                        break;
                    default : callback(false,null);
                }
            });

        }else{
            console.log("Unable to Connect! Check your network connection!");
            callback(false);
        }
    }

    function addQueue(doc,json,action,callback) {
        self.emit('addQueue');
        localQueue.indexedDB.open(function(status) {
            if(status) {
                localQueue.indexedDB.addQueue(doc,json,action,function(st) {
                    if(st) {
                        console.log("Data Added to Queue");
                        callback(true);
                    }
                })
            }
        })
    }
    //do not directly update, save it in a log
    //such that the UI can show it
    //save it in queue itself with action="conflict"

    function addConflict(newdata,olddata,callback) {
        localQueue.indexedDB.addConflict(newdata,olddata,function(status) {
            if(status) {
                console.log("Conflict Data logged at " + new Date().getTime());
                callback(true);
            }
            else{
                callback(false);
            }
        });
    }

    function getConflicts(callback) {
        localQueue.indexedDB.open(function(status) {
            if(status) {
                localQueue.indexedDB.getConflict(function(data) {
                    console.log(JSON.stringify(data));
                    if(!_.isEmpty(data)) callback(true,data);
                    else callback(false,null);
                })
            }else{
                callback(false,null);
            }
        });
    }

    function resolveConflict(id,callback) {
        console.log("Resolving Conflict of " + id);
        localQueue.indexedDB.open(function(status) {
            if(status) {
                localQueue.indexedDB.deleteQueue(id,function(st) {
                    callback(st);
                })
            }
        })
    }


//check internet connection
    function doesConnectionExist() {
        var check = navigator.onLine;
        return check;
    }



//---------------------------indexedDB functions--------------------------------



    _.extend(self,
        { init : init,
          addQueue : addQueue,
         localQueue : localQueue,
         getConflicts : getConflicts,
         resolveConflict : resolveConflict,
         addConflict : addConflict});

    return self;
}
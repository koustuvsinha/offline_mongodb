/**
 * Created by koustuv on 15/4/14.
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
                processQueue(function(st) {
                    callback(st);
                });

            }
        });
    }

    function processQueue(callback) {
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
                                callback(true);
                            })
                        }else{
                            callback(false);
                        }

                    })
                        break;
                    case "update" : remoteDB.update(data.document,data.data,function(status) {
                        if(status) {
                            console.log("Data updated at " + new Date().getTime());
                            localQueue.indexedDB.deleteQueue(data.timeStamp,function(status) {
                                console.log(status);
                                callback(true);
                            })
                        }
                        else{
                            callback(false);
                        }
                    })
                        break;
                }
            });

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


//check internet connection
    function doesConnectionExist() {
        var check = navigator.onLine;
        return check;
    }



//---------------------------indexedDB functions--------------------------------



    _.extend(self,
        { init : init,
          addQueue : addQueue,
         localQueue : localQueue});

    return self;
}
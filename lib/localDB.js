/**
 * Created by koustuv on 11/4/14.
 */
/**
 * Created by koustuv on 7/4/14.
 */

'use strict';
var queue = require('./queue')();
var _ = require('./lodash');
var EventEmitter = require('./events').EventEmitter;
var remote = require('./remote')('offline_mongo','9ZhT-BicRCFXZl-I9dtRqWfKOkAOZt2f');


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
        var trans = db.transaction([db_name]);
        var store = trans.objectStore(db_name);
        var ob = store.get(key);
        console.log("db_name " + db_name + ", key = " + key);
        ob.onsuccess = function(e) {
            var result = e.target.result;
            if(result) {
                console.log("Data Present! " + result);
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

    function sync() {
        console.log("Queue Syncing Starts " + new Date().getTime());
        queue.init(function() {
            console.log("RemoteDB Syncing Starts " + new Date().getTime());
            remote.readAll(function(data,status) {
                if(status) {
                    console.log(data);
                    //read one by one from document, search indexeddb for that document to be present, if not present insert it
                    //also, if present, check whether it has been updated or not

                    for(var i = 0; i < data.length; i++) {
                        if(data[i] !== "system.indexes" && data[i] !== "system.users") {
                            console.log("Reading Collection " + data[i]);
                            var collection = data[i];
                            remote.read(collection,function(msg,status) {
                                if(status) {
                                    console.log(JSON.stringify(msg));
                                    if(!_.isEmpty(msg)) {
                                        checkAndInsert(collection,msg,function(st) {
                                            console.log(st);
                                        })
                                    }
                                }
                            })
                        }
                    }

                }
            })
        });




    }

    //check synced data and insert

    function checkAndInsert(collection,data,callback) {
        _(data).forEach(function(record) {
            console.log("Searching for Record " + JSON.stringify(record) + " in " + collection);
            init(collection,function() {
                localSave.indexedDB.hasItem(collection,record._id,function(status,result) {
                    console.log("Found Status : " + status);
                    //localSave.indexedDB.close();
                    if(!status) {
                        //not present in indexedDB, so insert!
                        localSave.indexedDB.addItem(collection,record,function(st) {
                            if(st) {
                                console.log("Data Synced from Remote!");
                            }
                        })
                        callback(true);
                    }
                   else{
                        //present in indexeddb
                        //check if the data is not updated
                        if(!_.isEqual(record,result)) {
                            localSave.indexedDB.addItem(collection,record,function(st) {
                                if(st) {
                                    console.log("Data Updated! "+ JSON.stringify(record));
                                }
                            })
                        }
                        callback(false);
                   }
                })
            })

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

    //find document by query

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
                            var search = _.filter(data,query);
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


    /*
    function loadData() {
        localQueue.indexedDB.getQueue();
        return localQueue.indexedDB.resultArray;
    }
    */

    _.extend(self, {
        init : init,
        addData : addData,
        getData : getData,
        sync : sync,
        addID : addID,
        findData : findData
    })

    return self;

}
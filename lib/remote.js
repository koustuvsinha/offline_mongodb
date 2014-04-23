/**
 * Created by koustuv on 16/4/14.
 */
var _ = require('./lodash');
var EventEmitter = require('./events').EventEmitter;
var async = require('./async');
var $ = require('./jquery');


module.exports = function(db,api) {
    var self = new EventEmitter();


    //check whether remote db is accesible
    function isAccessible(callback) {
        $.ajax({
            type : "GET",
            url : "https://api.mongolab.com/api/1/databases?apiKey="+api
        })
            .done(function(msg) {
                console.log("Remote DB Accessible at " + new Date().getTime());
                callback(true);
        })
            .error(function(msg) {
                console.log("Remote DB Not Accessible");
                callback(false);
            })
    }

    //read from remotedb

    function read(collection,callback) {
        console.log("isAccessible call at " + new Date().getTime());
        isAccessible(function(status) {
            console.log("in callback function");
            console.log("Status : " + status);
            if(status) {
                $.ajax({
                    type : "GET",
                    url : "https://api.mongolab.com/api/1/databases/" + db + "/collections/" + collection + "?apiKey=" + api,
                    dataType: "json"
                })
                    .done(function(msg){
                        console.log("Returned Value = " + JSON.stringify(msg));
                        callback(msg,true);
                    })
                    .error(function(msg){
                        console.log("Error!");
                        callback({},false);
                    })
            }
        });
    }

    function readAll(callback) {
        isAccessible(function(status) {
            console.log("in callback function");
            console.log("Status : " + status);
            if(status) {
                $.ajax({
                    type : "GET",
                    url : "https://api.mongolab.com/api/1/databases/" + db + "/collections?apiKey=" + api,
                    dataType: "json"
                })
                    .done(function(msg){
                        console.log("Returned Value = " + JSON.stringify(msg));
                        callback(msg,true);
                    })
                    .error(function(msg){
                        console.log("Error!");
                        callback({},false);
                    })
            }
        });
    }

    //insert into remotedb
    function insert(collection,payload,callback) {
        console.log("in Insert method " + new Date().getTime());
        isAccessible(function(status) {
           console.log("Status : " + status);
            if(status) {
                getTimeStamp(payload,function(st,jsondata) {
                    if(st) {
                        $.ajax({
                            type : "POST",
                            url : "https://api.mongolab.com/api/1/databases/" + db + "/collections/" + collection + "?apiKey=" + api,
                            data : JSON.stringify(jsondata),
                            contentType : "application/json"
                        })
                            .done(function(msg) {
                                console.log("Insert Done : " + JSON.stringify(msg));
                                callback(true);
                            })
                            .error(function(msg) {
                                console.log("Error! " + JSON.stringify(msg));
                                callback(false);
                            })
                    }
                })
            }
        });
    }

    //update

    function update(collection,payload,callback) {
        console.log("in Update method " + new Date().getTime());
        var id = JSON.stringify(_.pick(payload,"_id"));
        isAccessible(function(status) {
            if(status) {
                $.ajax({
                    type : "PUT",
                    url : "https://api.mongolab.com/api/1/databases/" + db + "/collections/" + collection + "?apiKey=" + api + "&q=" + id,
                    data : JSON.stringify(payload),
                    contentType : "application/json"
                })
                    .done(function(msg) {
                        console.log("Update Done : " + JSON.stringify(msg));
                        callback(true);
                    })
                    .error(function(msg) {
                        console.log("Error! " + JSON.stringify(msg));
                        callback(false);
                    })
            }
        })
    }

    //delete

    function remove(collection,payload,callback) {
        console.log("in Remove method " + new Date().getTime());
        var id = JSON.stringify(_.pick(payload,"_id"));
        isAccessible(function(status) {
            if(status) {
                $.ajax({
                    type : "PUT",
                    url : "https://api.mongolab.com/api/1/databases/" + db + "/collections/" + collection + "?apiKey=" + api + "&q=" + id,
                    data : JSON.stringify([]),
                    contentType : "application/json"
                })
                    .done(function(msg) {
                        console.log("Delete Done : " + JSON.stringify(msg));
                        callback(true);
                    })
                    .error(function(msg) {
                        console.log("Error! " + JSON.stringify(msg));
                        callback(false);
                    })
            }
        })
    }

    //XHRfunction
    function ajax() {
        $.ajax({
            type : "GET",
            url : "https://api.mongolab.com/api/1/databases?apiKey=" + api,
            dataType : "json"
        })
            .done(function(msg) {
                console.log(msg);
            })

    }

    function getTimeStamp(payload,callback) {

        var timeStamp = new Date().getTime();
        _.assign(payload,{"timeStamp" : timeStamp});
        console.log("TimeStamp Assigned " + JSON.stringify(payload));
        callback(true,payload);


        /*
        $.ajax({
            type : "GET",
            url : "http://api.timezonedb.com?zone=Asia/Kolkata&format=json&key=U3A98XNKXE9F",
            dataType : "json"
        })
        .done(function(msg) {
                _.assign(payload,{"timeStamp" : msg.timestamp});
                callback(true,payload);
        })
        .error(function(msg) {
                callback(false,payload);
        })
        */
    }

    _.extend(self, {
        read : read,
        readAll : readAll,
        insert : insert,
        update : update,
        remove : remove,
        ajax : ajax
    });

    return self;

}
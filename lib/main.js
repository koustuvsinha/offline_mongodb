//test

var lo =  require('./lib/localDB');
//var request = require('request');

function addManyData(json) {
    lo.addData(json);
    console.log("added data");

}

function getData(query) {
    lo.getData(query);
    console.log("retrieved data");
}

/*
request('http://www.google.com', function (error, response, body) {
    if (!error && response.statusCode == 200) {
        console.log(body) // Print the google web page.
    }else{
        console.log(error);
    }
});
*/
//addData(serve);
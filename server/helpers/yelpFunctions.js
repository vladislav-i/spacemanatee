var yelp = require('./yelp');
var key = require('../api/api_key');

// create yelp client using Oauth
var yelpClient = yelp.createClient({
  consumer_key: key.consumer_key,
  consumer_secret: key.consumer_secret,
  token: key.token,
  token_secret:  key.token_secret,
  ssl: key.ssl
});

// yelp search parameter configuration
var yelpProperty = {
  term: "food",           // Type of business (food, restaurants, bars, hotels, etc.)
  limit: 10,              // Number of entries returned from each call
  sort: 2,                // Sort mode: 0=Best matched (default), 1=Distance, 2=Highest Rated
  radius_filter: 1609.34  // Search radius: 1 mile = 1609.3 meters
};

// function to use yelp API to get the top choices based on longitude and latitude
module.exports.searchYelp = function (req, res, googleCoords, callback) {
  //Counter variable which will keep track of how many Yelp calls have completed
  //A separate counter is needed due to the asynchronous nature of web requests
  var counter = 0;
  // Array that stores all of the Yelp results from all calls to Yelp
  var yelpResults = [];
  //Request yelp for each point along route that is returned by filterGoogle.js
  for(var i = 0; i < googleCoords.length; i++){
    //yelpClient.search is asynchronous and so we must use a closure scope to maintain the value of i
    (function(i) {
      yelpClient.search({
        term: yelpProperty.term,
        limit: yelpProperty.limit,
        sort: yelpProperty.sort,
        radius_filter: yelpProperty.radius_filter,
        ll: googleCoords[i]
      }, function(error, data) {
        if (error) {
          console.log(error);
        }
        //Push the data returned from Yelp into yelpResults array
        yelpResults[i] = data;
        counter++;
        //After all yelp results are received call callback with those results
        if(counter === googleCoords.length){
          callback(yelpResults);
        }
     });
    })(i);
  }
};

//Filter results returned from Yelp into an overall top 10
module.exports.createTopResultsJSON = function(yelpResults) {
  var allBusinesses = [];
  var topResults = [];
  var minRating = 0;

  //Push all businesses from yelpResults into one array for easy filtering
  for(var i = 0; i < yelpResults.length; i++){
    if(yelpResults[i].businesses){
      allBusinesses = allBusinesses.concat(yelpResults[i].businesses);
    }
  }
  //loop through each business and compare ratings, only push the overall top 10 into topResults
  for(var j = 0; j < allBusinesses.length; j++){
    //yelp includes some highly rated businesses well outside of the search radius, possibly a "featured business"
    //if such a business is included, skip over it
    if(allBusinesses[j].distance > yelpProperty.radius_filter){
      continue;
    }
    //Push the first 10 businesses into topResults
    if(topResults.length < 10){
      topResults.push(allBusinesses[j]);
    } else {
      //compare ratings
      for(var k = 0; k < topResults.length; k++){
        //Check rating
        if(allBusinesses[j].rating > topResults[k].rating){
          topResults[k] = allBusinesses[j];
          //once a business is added to topResults, move on to the next business
          break;
        //if ratings are equal, choose the business with higher number of reviews
        } else if(allBusinesses[j].rating === topResults[k].rating && allBusinesses[j].review_count > topResults[k].review_count){
          topResults[k] = allBusinesses[j];
          //once a business is added to topResults, move on to the next business
          break;
        }
      }
    }
  }

  var result = {
    results: topResults
  };

  return result;
}

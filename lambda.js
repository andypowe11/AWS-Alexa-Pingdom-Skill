'use strict';

// Configure the next 5 variables
const DYNAMODBTABLE = 'pingdom-cache';
const PINGDOMUSER = 'someone@example.com';
const PINGDOMPASS = 'your_pingdom_password';
const PINGDOMAPPKEY = 'your_pingom_application_key';
// Amazon Skill Application Id
const APPLICATIONID = 'your_amazon_application_id';

const AWS = require('aws-sdk');
var pingdomApi = require('pingdom-api')({
  user: PINGDOMUSER,    // user account login
  pass: PINGDOMPASS,    // user account password
  appkey: PINGDOMAPPKEY // pingdom application key
});
const dynamodb = new AWS.DynamoDB({region: 'eu-west-1'});
var Promise = require('promise');

// Helpers that build all of the responses

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output,
    },
    card: {
      type: 'Simple',
      title: `SessionSpeechlet - ${title}`,
      content: `SessionSpeechlet - ${output}`,
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText,
      },
    },
    shouldEndSession,
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes,
    response: speechletResponse,
  };
}

// Functions that control the skill's behavior

function getWelcomeResponse(callback) {
  const sessionAttributes = {};
  const cardTitle = 'Welcome';
  const speechOutput = 'Welcome to Pingdom';
  const repromptText = 'Please start by saying, ' +
    'overview';
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getHelpResponse(callback) {
  const sessionAttributes = {};
  const cardTitle = 'Help';
  const speechOutput = 'Say, overview, or say, summary, and then the name of a website';
  const repromptText = 'Please try saying, overview, or, summary, and then the name of a website';
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Session Ended';
  const speechOutput = 'Thank you for using Pingdom. Have a nice day!';
  // Setting this to true ends the session and exits the skill.
  const shouldEndSession = true;

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function createWebsiteAttributes(website) {
  return {
    website,
  };
}

// Sets the current website in the session
function setWebsiteInSession(intent, session, callback) {
  const cardTitle = intent.name;
  const websiteSlot = intent.slots.Website;
  let repromptText = '';
  let sessionAttributes = {};
  const shouldEndSession = false;
  let speechOutput = '';

  if (websiteSlot) {
    const website = websiteSlot.value;
    sessionAttributes = createWebsiteAttributes(website);
    speechOutput = `I now know your current website is ${website}`;
    repromptText = "You can ask me your current website by saying, what is my current website?";
  }
  else {
    speechOutput = "I'm not sure what your current website is. Please try again.";
    repromptText = "I'm not sure what your current website is. You can tell me your " +
      'current website by saying, my current website is, and then the name of the website';
  }

  callback(sessionAttributes,
     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getWebsiteFromSession(intent, session, callback) {
  let website;
  const repromptText = null;
  const sessionAttributes = {};
  let shouldEndSession = false;
  let speechOutput = '';

  if (session.attributes) {
    website = session.attributes.website;
  }

  if (website) {
    speechOutput = `Your current website is ${website}. Goodbye.`;
    shouldEndSession = true;
  }
  else {
    speechOutput = "I'm not sure what your current website is. Say, my current website " +
      ' is, and then the name of the website';
  }
  callback(sessionAttributes,
     buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
}

function getOverview(intent, session, callback) {
  const cardTitle = intent.name;
  let sessionAttributes = {};
  let shouldEndSession = false;
  let speechOutput = '';
  let repromptText = 'Try saying overview again';
  var sitesummaries = {};

  new Promise((resolve, reject) => {
    dynamodb.scan({ TableName : DYNAMODBTABLE }, function(err, data) {
      if (err) {
        console.log("Scan error: ", err);
        speechOutput = 'Sorry, this skill seems to be broken';
        callback(sessionAttributes,
          buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
        return reject(err);
      }
      else {
        // console.log(JSON.stringify(data));
        sitesummaries = data.Items;
        resolve();
      }
    });
  }).then(() => {
    var resp = ''; // this is going to be the response that Alexa reads out
    var now = new Date();
    var downcount = 0;
    var upcount = 0;
    var slafailcount = 0;
    var slagoodcount = 0;
    var unstablecount = 0;
    console.log(JSON.stringify(sitesummaries));
    for (var site in sitesummaries) {
      site = sitesummaries[site];
      if (site.status.S == 'up') upcount++;
      else downcount++;
      if (site.type.S == 'customer' &&
        (parseFloat(site.availability3months.N) < 9970.0 || parseFloat(site.availability1month.N) < 9970.0))
        slafailcount++;
      else slagoodcount++;
      var since = new Date(site.lasterrortime.N * 1000);
      if (site.type.S == 'customer' && since > now - (7*24*60*60*1000)) // 1 week in ms
        unstablecount++;
    }
    if (downcount == 0) resp = randomGoodText() + "everything is up!\n";
    else if (upcount == 0) resp = randomBadText() + "everything is down!\n";
    else {
      if (upcount == 1) resp = upcount + " website is up and ";
      else resp = upcount + " websites are up and ";
      if (downcount == 1) resp += downcount + " website is down.\n";
      else resp += downcount + " websites are down.\n";
    }
    if (slafailcount == 0) resp += randomGoodText() + "all customer websites are meeting our SLA!\n";
    else if (slagoodcount == 0) resp += randomBadText() + "no customer websites are meeting our SLA!\n";
    else {
      if (downcount == 0) resp += "However, ";
      if (slafailcount == 1) resp += slafailcount + " customer website is NOT meeting our SLA ";
      else resp += slafailcount + " customer websites are NOT meeting our SLA ";
      if (slagoodcount == 1) resp += "(" + slagoodcount + " is).\n";
      else resp += "(" + slagoodcount + " are).\n";
    }
    if (unstablecount > 0) resp += unstablecount+" customer websites look like they might be a bit unstable (they've been up less than a week).\n";
    speechOutput = resp;

    console.log("speechOutput: ", speechOutput);
    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  });
}

function getSummary(intent, session, callback) {
  let website;
  const cardTitle = intent.name;
  const websiteSlot = intent.slots.Website;
  let sessionAttributes = {};
  var shouldEndSession = false;
  let speechOutput = '';
  let repromptText = '';

  var sitesummaries = {};
  var sitesummary = {};
  var id;

  if (session.attributes) {
    website = session.attributes.website;
  }
  if (websiteSlot) {
    if (websiteSlot.value) {
      website = websiteSlot.value;
    }
  }
  if (website) {
    sessionAttributes = createWebsiteAttributes(website);

    new Promise((resolve, reject) => {
      dynamodb.scan({ TableName : DYNAMODBTABLE }, function(err, data) {
        if (err) {
          console.log("Scan error: ", err);
          speechOutput = 'Sorry, this skill seems to be broken';
          callback(sessionAttributes,
            buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
          return reject(err);
        }
        else {
          // console.log(JSON.stringify(data));
          sitesummaries = data.Items;
          resolve();
        }
      });
    }).then(() => {
      console.log(JSON.stringify(sitesummaries));
      id = '';
      var possibles = '';
      var matchcount = 0;
      var exactmatch = new RegExp('^'+website+'$', 'i');
      var loosematch = new RegExp('.*'+website+'.*', 'i');
      for (var site in sitesummaries) {
        site = sitesummaries[site];
        console.log(site.id.S);
        if (site.name.S.match(exactmatch)) {
          console.log("We have an exact match: ", site.id.S);
          matchcount = 1;
          id = site.id.S;
          break;
        }
        if (site.name.S.match(loosematch)) {
          console.log("We have a match: ", site.id.S);
          matchcount++;
          possibles += site.name.S+", ";
          id = site.id.S;
        }
      }
      if (matchcount > 1) {
        resp = "Hmmm. which of the following do you mean? "+possibles;
        resp = resp.substring(0, resp.length - 2); // remove trailing ", "
        speechOutput = resp;
        callback(sessionAttributes,
          buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      }
      else if (matchcount == 0) {
        resp = "Sorry. I don't know which website you mean.\n";
        speechOutput = resp;
        callback(sessionAttributes,
          buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
      }
      else {
        console.log('Sitesummary id: ', id);
        var params = {
          TableName: 'pingdom-cache',
          Key: {
            'id': { 'S' : id }
          }
        };
        new Promise((resolve, reject) => {
          dynamodb.getItem(params, function(err, data) {
            if (err) {
              console.log("getItem error: ", err);
              speechOutput = 'Sorry, this skill seems to be broken';
              shouldEndSession = true;
              callback(sessionAttributes,
                buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
              return reject(err);
            }
            else {
              sitesummary = data.Item;
              resolve();
            }
          });
        }).then(() => {
          console.log("getItem response: ", JSON.stringify(sitesummary));
          var resp = ''; // this is going to be the response that Alexa reads out
          var now = new Date();
          var myname = sitesummary.name.S;
          resp = "Website summary for "+sitesummary.name.S+".\n";
          if (sitesummary.type.S == 'customer') resp += "This is a customer website hosted by us.\n";
          if (sitesummary.type.S == 'internal') resp += "This is an internal website hosted by us.\n";
          if (sitesummary.type.S == 'external') resp += "This is an external website hosted by a third-party provider.\n";
          resp += "Status: "+sitesummary.status.S+".\n";
          var since = new Date(sitesummary.lasterrortime.N * 1000);
          if (sitesummary.status.S == 'up') {
            resp += " "+msToString(now - since)+"\n";
          }
          var a = parseFloat(sitesummary.availability1day.N)/100.0;
          resp += "\nAvailability today: "+a+"%.\n";
          a = parseFloat(sitesummary.availability1week.N)/100.0;
          resp += "Availability over past week: "+a+"%.\n";
          a = parseFloat(sitesummary.availability1month.N)/100.0;
          resp += "Availability over past month: "+a+"%.\n";
          a = parseFloat(sitesummary.availability3months.N)/100.0;
          resp += "Availability over past 3 months: "+a+"%.\n";
          if (sitesummary.type.S == 'customer' &&
             (parseFloat(sitesummary.availability3months.N) < 9970.0 || parseFloat(sitesummary.availability1month.N) < 9970.0))
               resp += "WARNING: This availability level is below our published SLA.\n";
          speechOutput = resp;
          console.log("speechOutput: ", speechOutput);
          //shouldEndSession = true;
          callback(sessionAttributes,
            buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
        });
      }
    });
  }
  else {
    speechOutput = "Which website?";
    repromptText = "You need to tell me which website";
    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  }
}

function handleThanks(intent, session, callback) {
  const cardTitle = intent.name;
  let sessionAttributes = {};
  const shouldEndSession = true;
  let speechOutput = '';
  let repromptText = '';

  speechOutput = randomThanksText();

  callback(sessionAttributes,
     buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

// Events

// Called when the session starts.
function onSessionStarted(sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

// Called when the user launches the skill without specifying what they want.
function onLaunch(launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);
  getWelcomeResponse(callback);
}

// Called when the user specifies an intent for this skill.
function onIntent(intentRequest, session, callback) {
  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

  const intent = intentRequest.intent;
  const intentName = intentRequest.intent.name;
  
  console.log("Name: ", intentName);

  if (intentName === 'SetWebsiteIntent') {
    setWebsiteInSession(intent, session, callback);
  }
  else if (intentName === 'GetWebsiteIntent') {
    getWebsiteFromSession(intent, session, callback);
  }
  else if (intentName === 'ThanksIntent') {
    handleThanks(intent, session, callback);
  }
  else if (intentName === 'OverviewIntent') {
    getOverview(intent, session, callback);
  }
  else if (intentName === 'SummaryIntent') {
    getSummary(intent, session, callback);
  }
  else if (intentName === 'NullIntent') {
    handleSessionEndRequest(callback);
  }
  else if (intentName === 'AMAZON.HelpIntent') {
    getHelpResponse(callback);
  }
  else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    handleSessionEndRequest(callback);
  }
  else {
    throw new Error('Invalid intent');
  }
}

function randomBadText() {
  var i = randomInt(100);
  if (i < 20) return "Hmmm.\n";
  else if (i < 40) return "Not so good.\n";
  else if (i <60) return "You might want to sit down for this.\n";
  else if (i < 80) return "Shit.\n";
  else return "Not great.\n";
}

function randomGoodText() {
  var i = randomInt(100);
  if (i < 20) return "It's OK.\n";
  else if (i < 40) return "All good.\n";
  else if (i <60) return "Awesome.\n";
  else if (i < 80) return "Great.\n";
  else return "Looking good.\n";
}

function randomThanksText() {
  var i = randomInt(100);
  if (i < 20) return "That's OK";
  else if (i < 40) return "No worries";
  else if (i <60) return "You're welcome";
  else if (i < 80) return "You are too kind";
  else return "Sure thing buddy";
}

// Random integer between 0 and high
function randomInt(high) {
  return Math.floor(Math.random() * high);
}

function msToString(ms) {
  var seconds = Math.round(ms / 1000);
  var years = Math.floor(seconds / 31536000);
  var days = Math.round((seconds % 31536000) / 86400); 
  var hours = Math.floor(((seconds % 31536000) % 86400) / 3600);
// var minutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
// var seconds = (((seconds % 31536000) % 86400) % 3600) % 60;
  if (years > 1) {
    return "more than "+years+" years";
  }
  else if (years > 0) {
    return "more than 1 year";
  }
  else if (days > 1) {
    return days+" days";
  }
  else if (days > 0) {
    return "1 day";
  }
  else if (hours > 1) {
    return "more than "+hours+" hours";
  }
  else if (hours > 0) {
    return "more than 1 hour";
  }
  else {
    return "less than 1 hour";
  }
}

// Called when the user ends the session.
function onSessionEnded(sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
}

// Main handler

// Route the incoming request based on type
exports.handler = (event, context, callback) => {
  try {
    console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

    if (APPLICATIONID != '') {
      if (event.session.application.applicationId !== APPLICATIONID) {
       callback('Invalid Application ID');
      }
    }

    if (event.session.new) {
      onSessionStarted({ requestId: event.request.requestId }, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    }
    else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    }
    else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      callback();
    }
  }
  catch (err) {
    callback(err);
  }
};

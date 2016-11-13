# AWS Alexa Pingdom Skill

An Alexa skill to find out the status of any websites you monitor with Pingdom, built using Claudia.js and the Alexa Skills Kit..
The following Alexa commands are available:

    Alexa, ask Pingdom for an overview
    Alexa, ask Pingdom for a summary of website_name

or you can jusy say

    Alexa, open Pingdom

and take it from there.

The Alexa skill is written in Node.js and
runs in AWS Lambda.
It is deployed using Claudia.js - see
https://claudiajs.com/.

## Dependencies

This bot uses the simple Pingdom cache described at https://github.com/andypowe11/AWS-Lambda-Pingdom-cache. This must be installed and running prior to using this bot.

## Installation

Install Claudia.js with:

    npm install claudia -g

Create a project folder. Go into it and type:

    npm init

Give your bot a name - e.g. 'pingdom' - and description
and put your email address
as author. Leave everything else as is. Then install the dependencies with:

    npm install claudia-bot-builder -S
    npm install promise-delay -S
    npm install aws-sdk -S
    npm install pingdom-api -S

Put lambda.js in the project folder.

Edit the 5 variables at the top of the file:

| Variable | Description |
|----------|-------------|
| DYNAMODBTABLE | The DynamoDB table used as a Pingdom API cache. Defaults to 'pingdom-cache' |
| PINGDOMUSER | Your Pindom username, typically an email address |
| PINGDOMPASS | Your Pingdom password |
| PINGDOMAPPKEY | Your Pingdom Application API Key - see the Pingdom API documentation for details |
| APPLICATIONID | The application ID of your Alexa skill |

Follow https://claudiajs.com/tutorials/installing.html to give Claudia.js
enough AWS access to deploy the Lambda function and API Gateway.

Then deploy your bot to AWS with the following command:

    claudia create --region us-east-1 --handler lambda.handler --role ap-basicalexaskill

Follow the steps to create a custom Alexa skill at https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/overviews/steps-to-build-a-custom-skill. The intent schema and sample utterances are available...


Go to https://api.slack.com/ to configure a new integration
for your Slack team. Then run:

    claudia update --region eu-west-1 --api-module bot --timeout 120 --allow-recursion --configure-slack-slash-command

That's it, you're done.

If you modify the bot.js code, you can redeploy with:

    claudia update

## Removal

To delete everything from AWS, try the following:

    claudia destroy
    rm claudia.json

However, sometimes this doesn't seem to work reliably. If so, manually delete
the stuff created under IAM Roles, Lambda functions and API Gateway.

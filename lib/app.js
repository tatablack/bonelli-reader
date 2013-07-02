/* Requiring dependencies */
var nconf = require('nconf'),
    request = require('request'),
    _ = require('underscore'),
    fs = require('fs'),
    Step = require('step'),
    connect = require('connect'),
    BonelliParser = require('./BonelliParser');

// Initializing configuration
nconf.file({ file: './config.json' });

// Global instances
var bonelliParser = new BonelliParser(),
    app = connect();

// Web application entry point
app.use(function(req, res) {
    Step(
        function loadPage() {
            var requestGroup = this.group();

            request(nconf.get('urls:edicola'), requestGroup());
            request(nconf.get('urls:prossimamente'), requestGroup());
        },

        function scrape(err, responses) {
            if (err) throw err;

            var issues = [];

            _.each(responses, function parsePage(response) {
                issues = _.union(issues, bonelliParser.getIssues(response.body, nconf));
            });

            return issues;
        },

        function output(err, issues) {
            if (err) throw err;

            var sms = '';

            var templateList = _.template(fs.readFileSync('./views/output.html', 'UTF-8')),
                templateRowKnown = _.template(fs.readFileSync('./views/row-known.html', 'UTF-8')),
                templateRowUnknown = _.template(fs.readFileSync('./views/row-unknown.html', 'UTF-8'));

            _.map(issues, function(issue) {
                if (issue.unknown) {
                    sms += templateRowUnknown({issue: issue});
                } else {
                    sms += templateRowKnown({issue: issue});
                }
            });

            var prices = _.compact(_.pluck(issues, 'price')),
                totalCost = _.reduce(prices, function(total, price) {
                    return total += parseFloat(price);
                }, 0.0).toFixed(2),
                missingPrices = issues.length - prices.length;

            res.end(templateList({
                sms: sms,
                totalCost: totalCost,
                missingPrices: missingPrices
            }));
        }
    );
}).listen(process.env.PORT);

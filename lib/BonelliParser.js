/* Requiring dependencies */
var cheerio = require('cheerio'),
    _ = require('underscore'),
    moment = require('moment'),
    Selectors = require('./BonelliSelectors');

function BonelliParser() {
    moment.lang('it');
    var now = moment();

    var $ = function(body) {
        return cheerio.load(body, {
            ignoreWhitespace: true
        });
    };

    var $$ = function(body, selector) {
        return $(body)(selector);
    };


    var getDates = function(mainElement) {
        var dates = mainElement.find(Selectors.DATES);

        dates = _.reject(dates, function filterDates(dateElement, loopIndex) {
            return !dateElement.children.length;
        });

        dates = _.map(dates, function extractDate(dateElement) {
            return moment(dateElement.children[0].data.substring(5), 'DD MMMM');
        }, this);

        return dates;
    };

    var getCovers = function(mainElement) {
        return mainElement.find(Selectors.COVERS);
    };

    var getSeriesIds = function(covers) {
        var seriesIds = [];

        _.map(covers, function(cover) {
            var url = cover.parent.attribs.href;
            seriesIds.push(url.substring(url.indexOf('=') + 1, url.indexOf('&')));
        });

        return seriesIds;
    };

    var getSeriesPlacings = function(covers) {
        var seriesPlacings = [];

        _.map(covers, function(cover) {
            var url = cover.parent.attribs.href;
            seriesPlacings.push(
                url.substring(
                    url.indexOf('=', url.indexOf('&') + 1) + 1,
                    url.indexOf('&', url.indexOf('&') + 1))
            );
        });

        return seriesPlacings;
    };

    var getIssueNumbers = function(covers) {
        var issueNumbers = [];

        _.map(covers, function(cover) {
            var url = cover.parent.attribs.href;
            issueNumbers.push(parseInt(url.substring(url.lastIndexOf("=") + 1), 10));
        });

        return issueNumbers;
    };

    var toObjectArray = function(issueArray) {
        return _.map(issueArray, function(issue) {
            return _.object(['date', 'id', 'placing', 'number'], issue);
        });
    };

    var onlyMyMonthlyIssues = function(issues, nconf) {
        return _.reject(issues, function(issue) {
            return  _.indexOf(nconf.get('series:uninteresting'), issue.id) !== -1 || // Skip uninteresting issues
                    issue.date.month() !== now.month();                              // Skip other months' issues
        });
    };

    var withDaysFormatted = function(issues) {
        return _.map(issues, function(issue) {
            issue.date = issue.date.format('D/MM');
            return issue;
        });
    };

    var andOtherInfo = function(issues, nconf) {
        return _.map(issues, function(issue) {
            var issueData = nconf.get('series:all')[issue.id];

            issue.unknown = (issueData === undefined);

            if (!issue.unknown) {
                issue.shortTitle = issueData[1];
                issue.price = issueData[2];
            } else {
                issue.price = '';
            }

            return issue;
        });
    };

    return {
        getIssues: function(body, nconf) {
            var mainElement = $$(body, Selectors.ISSUES),
                dates = getDates(mainElement),
                covers = getCovers(mainElement),
                seriesIds = getSeriesIds(covers),
                seriesPlacings = getSeriesPlacings(covers),
                issueNumbers = getIssueNumbers(covers);

            var issues = toObjectArray(_.zip(dates, seriesIds, seriesPlacings, issueNumbers));

            issues = _.sortBy(onlyMyMonthlyIssues(issues, nconf), 'date');
            issues = withDaysFormatted(andOtherInfo(issues, nconf));

            return issues;
        }
    }
}

module.exports = BonelliParser;
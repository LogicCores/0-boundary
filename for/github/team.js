
exports.forLib = function (LIB) {

    var exports = {};

    function callGithub(token, path) {
        return LIB.Promise.promisify(function (callback) {
            var url = "https://api.github.com" + path;
            return LIB.request({
                url: url,
                headers: {
                    "User-Agent": "nodejs/request",
                    "Authorization": "token " + token
                },
                json: true
            }, function (err, res, body) {
                if (err) return callback(err);
                if (res.statusCode === 403 || res.statusCode === 404) {
                    console.error("Got status '" + res.statusCode + "' for url '" + url + "'! This is likely due to NOT HAVING ACCESS to this API call because your OAUTH SCOPE is too narrow! See: https://developer.github.com/v3/oauth/#scopes", res.headers);
                    var scope = null;
                    if (/^\/orgs\/([^\/]+)\/teams$/.test(path)) {
                        scope = "read:org";
                    } else
                    if (/^\/teams\/([^\/]+)\/members\/([^\/]+)$/.test(path)) {
                        scope = "read:org";
                    }
                    if (scope) {
                        console.error("We are going to start a new oauth session with the new require scope added ...");
                        var err = new Error("Insufficient privileges. Should start new session with added scope: " + scope);
                        err.code = 403;
                        err.requestScope = scope;
                        return callback(err);
                    }
                    return callback(new Error("Insufficient privileges. There should be a scope upgrade handler implemented for url '" + url + "'!"));
                }
                return callback(null, body);
            });
        })();
    }

    exports.isUserMember = function (info) {
        return LIB.Promise.try(function () {
            var teamUrlParts = LIB.url.parse(info.teamUrl);
            var m = teamUrlParts.path.match(/^\/orgs\/([^\/]+)\/teams\/([^\/]+)$/);
            if (!m) {
                throw new Error("Invalid team URL! Copy/paste the URL from github when viewing the team.");
            }
            return callGithub(info.token, "/orgs/" + m[1] + "/teams").then(function (teams) {
                var team = teams.filter(function (team) {
                    return (team.slug === m[2]);
                });
                if (team.length === 0) {
                    throw new Error("Team with slug '" + m[2] + "' not found on github!");
                }
                team = team.pop();
                return callGithub(info.token, "/teams/" + team.id + "/members").then(function (members) {
                    var member = members.filter(function (member) {
                        return (member.id == info.userId);
                    });
                    return (member.length === 1);
                });
            });
        });
    }

    return exports;
}

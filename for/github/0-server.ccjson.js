
exports.forLib = function (LIB) {
    var ccjson = this;

    const UUID = require("uuid");
    const TEAM = require("./team").forLib(LIB);

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            var Entity = function (instanceConfig) {
                var self = this;

                self.AspectInstance = function (aspectConfig) {

                    var config = {};
                    LIB._.merge(config, defaultConfig);
                    LIB._.merge(config, instanceConfig);
                    LIB._.merge(config, aspectConfig);
                    config = ccjson.attachDetachedFunctions(config);

                    var context = {
                        // TODO: Instead of re-using token, issue signed requests on demand
                        bypassToken: UUID.v4()
                    };

                    return LIB.Promise.resolve({
                        restrictToTeam: function () {
                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(function (credentials) {
                                    return TEAM.isUserMember({
                                        "teamUrl": config.teamUrl,
                                        "token": credentials.accessToken,
                                        "userId": credentials.id
                                    }).then(function (isMember) {
                                        if (isMember) {
                                            // Success
                                            return;
                                        }
                                        throw new Error("User with id '" + credentials.id + "' not found in team '" + config.teamUrl + "'");
                                    });
                                })
                            );
                        },
                        app: function () {
                            return LIB.Promise.resolve(
                                ccjson.makeDetachedFunction(
                                    function (req, res, next) {
                                        if (
                                            config.request &&
                                            config.request.contextAlias
                                        ) {
                                            if (!req.context) {
                                                req.context = {};
                                            }
                                            req.context[config.request.contextAlias] = LIB._.assign(context, {
                                                canBypass: function () {
                                                    if (
                                                        req.headers["x-boundary-bypass-token"] &&
                                                        req.headers["x-boundary-bypass-token"] === context.bypassToken
                                                    ) {
                                                        return true;
                                                    }
                                                    return false;
                                                }
                                            });
                                        }

                                        function authorize () {

                                            function isAuthorized () {
                                                // If there is a matching bypass token header we will allow the request
                                                if (
                                                    req.headers["x-boundary-bypass-token"] &&
                                                    req.headers["x-boundary-bypass-token"] === context.bypassToken
                                                ) {
                                                    // Token matches
                                                    return LIB.Promise.resolve(true);
                                                }
                                                if (
                                                    req.context.auth &&
                                                    req.context.auth.authorized === true
                                                ) {
                                                    return LIB.Promise.resolve(true);
                                                }
                                                return LIB.Promise.resolve(false);
                                            }
                                            
                                            return isAuthorized().then(function (isAuthorized) {
                                                if (isAuthorized) {
                                                    return true;
                                                }
                                                // Use is NOT authorized. See if we have a public route.
    
                                                if (
                                                    !config.public ||
                                                    !req.context.page
                                                ) {
                                                    // Authorize by default if no authorizer configured
                                                    return LIB.Promise.resolve(true);
                                                }
    
                                                return req.context.page.contextForUri(req.url).then(function (pageContext) {
                                                    function isPathAllowed () {
                                                        if (!pageContext) return false;
                                                        return (config.public.paths.indexOf(
                                                            pageContext.page.lookup.path
                                                        ) !== -1);
                                                    }
                                                    if (isPathAllowed()) {
                                                        return LIB.Promise.resolve(true);
                                                    }

                                                    if (req.headers["X-Request-Type"] === "background-fetch") {
                                                        // We are being asked to deny entry instead of redirecting.
                                                        return LIB.Promise.resolve(false);
                                                    }

                                                    return {
                                                        "redirectTo": pageContext.page.host.baseUrl + config.public.urls.unauthorizedRedirect
                                                    };
                                                });
                                            });
                                        }

                                        return authorize().then(function (authorized) {
                                            if (authorized !== true) {
                                                if (authorized.redirectTo) {
                                                    return res.redirect(authorized.redirectTo);
                                                }
                                                res.writeHead(403);
                                                return res.end("Forbidden");
                                            }
                                            return next();
                                        }).catch(next);
                                    }
                                )
                            );
                        }
                    });
                }

            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}


exports.forLib = function (LIB) {
    var ccjson = this;

    const UUID = require("uuid");
    const TEAM = require("./team").forLib(LIB);

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            var Entity = function (instanceConfig) {
                var self = this;

                var config = {};
                LIB._.merge(config, defaultConfig);
                LIB._.merge(config, instanceConfig);
                config = ccjson.attachDetachedFunctions(config);
                
                var context = config.context();

                var api = {
                    // TODO: Instead of re-using token, issue signed requests on demand
                    bypassToken: UUID.v4()
                };

                context.setAdapterAPI(api);

                self.AspectInstance = function (aspectConfig) {
                    
                    return LIB.Promise.all([
                        context.getAdapterAPI("page"),
                        context.getAdapterAPI("auth")
                    ]).spread(function (page, auth) {

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
                                                config.request.stateAlias
                                            ) {
                                                if (!req.state) {
                                                    req.state = {};
                                                }
                                                req.state[config.request.stateAlias] = LIB._.assign(api, {
                                                    canBypass: function () {
                                                        if (
                                                            req.headers["x-boundary-bypass-token"] &&
                                                            req.headers["x-boundary-bypass-token"] === api.bypassToken
                                                        ) {
                                                            return true;
                                                        }
                                                        return false;
                                                    }
                                                });
                                            }

                                            function authorize () {
    
                                                function isAuthorized () {
                                                    if (config.forceAuthorized === true) {
                                                        return LIB.Promise.resolve(true);
                                                    } else
                                                    // If there is a matching bypass token header we will allow the request
                                                    if (
                                                        req.headers["x-boundary-bypass-token"] &&
                                                        req.headers["x-boundary-bypass-token"] === api.bypassToken
                                                    ) {
                                                        // Token matches
                                                        return LIB.Promise.resolve(true);
                                                    }
                                                    if (
                                                        auth &&
                                                        auth.authorized === true
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
                                                        !page
                                                    ) {
                                                        // Authorize by default if no authorizer configured
                                                        return LIB.Promise.resolve(true);
                                                    }
        
                                                    return page.contextForUri(req.url).then(function (pageContext) {
                                                        function isPathAllowed () {
                                                            if (!pageContext) return false;
                                                            return (config.public.paths.indexOf(
                                                                pageContext.page.lookup.path
                                                            ) !== -1);
                                                        }
                                                        if (isPathAllowed()) {
                                                            return LIB.Promise.resolve(true);
                                                        }
    
                                                        if (
                                                            req.headers["X-Request-Type"] === "background-fetch" ||
                                                            req.headers["X-Request-Type"] === "background-request"
                                                        ) {
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
                    });
                }

            }
            Entity.prototype.config = defaultConfig;

            return Entity;
        }
    });
}

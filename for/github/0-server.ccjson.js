
exports.forLib = function (LIB) {
    var ccjson = this;

const DEBUG = false;

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
                        context.getAdapterAPI("page")
                    ]).spread(function (page) {

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
                                                    hasBypassHeader: function () {
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
if (DEBUG) console.log(req.url, "[boundary] Authorize: valid bypass token");                                                        
                                                        // Token matches
                                                        return LIB.Promise.resolve(true);
                                                    }
if (DEBUG) console.log(req.url, "[boundary] req.state:", req.state);                                                        
                                                    
                                                    if (
                                                        req.state.auth &&
                                                        req.state.auth.authorized === true
                                                    ) {
if (DEBUG) console.log(req.url, "[boundary] Authorize: forced authorize");                                                        
                                                        return LIB.Promise.resolve(true);
                                                    }
if (DEBUG) console.log(req.url, "[boundary] NO Authorize: not authorized by config/interal request");                                                        
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
if (DEBUG) console.log(req.url, "[boundary] Authorize: Public page");
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
if (DEBUG) console.log(req.url, "[boundary] Authorize: Public page");
                                                            return LIB.Promise.resolve(true);
                                                        }
    
                                                        if (
                                                            req.headers["X-Request-Type"] === "background-fetch" ||
                                                            req.headers["X-Request-Type"] === "background-request"
                                                        ) {
if (DEBUG) console.log(req.url, "[boundary] NO Authorize: return 403");
                                                            // We are being asked to deny entry instead of redirecting.
                                                            return LIB.Promise.resolve(false);
                                                        }

if (DEBUG) console.log(req.url, "[boundary] NO Authorize: redirect");
                                                        return {
                                                            "redirectTo": pageContext.page.host.baseUrl + config.public.urls.unauthorizedRedirect
                                                        };
                                                    });
                                                });
                                            }
    
    
if (DEBUG) console.log(req.url, "[boundary] Check authorize");
    
                                            return authorize().then(function (authorized) {
                                                if (authorized !== true) {
                                                    if (authorized.redirectTo) {
if (DEBUG) console.log(req.url, "[boundary] NO Authorize: ACT 302");
                                                        return res.redirect(authorized.redirectTo);
                                                    }
if (DEBUG) console.log(req.url, "[boundary] NO Authorize: ACT 403");
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

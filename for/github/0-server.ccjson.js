
exports.forLib = function (LIB) {
    var ccjson = this;

    return LIB.Promise.resolve({
        forConfig: function (defaultConfig) {

            var Entity = function (instanceConfig) {
                var self = this;

                self.AspectInstance = function (aspectConfig) {

                    return LIB.Promise.resolve({
                        path: function () {

                            var config = {};
                            LIB._.merge(config, defaultConfig);
                            LIB._.merge(config, instanceConfig);
                            LIB._.merge(config, aspectConfig);

                            return LIB.Promise.resolve(
                                LIB.path.join(config.basePath, config.namespace || "")
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

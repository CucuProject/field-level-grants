"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMongooseProjection = void 0;
function buildMongooseProjection(fields) {
    return [...fields].join(' ');
}
exports.buildMongooseProjection = buildMongooseProjection;

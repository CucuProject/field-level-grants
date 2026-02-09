"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMongooseProjection = buildMongooseProjection;
function buildMongooseProjection(fields) {
    return [...fields].join(' ');
}

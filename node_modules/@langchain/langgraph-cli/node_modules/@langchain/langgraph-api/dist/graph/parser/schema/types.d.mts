import * as ts from "typescript";
import type { JSONSchema7 } from "json-schema";
type Args = {
    ref: boolean;
    aliasRef: boolean;
    topRef: boolean;
    titles: boolean;
    defaultProps: boolean;
    noExtraProps: boolean;
    propOrder: boolean;
    typeOfKeyword: boolean;
    required: boolean;
    strictNullChecks: boolean;
    esModuleInterop: boolean;
    experimentalDecorators: boolean;
    out: string;
    validationKeywords: string[];
    include: string[];
    excludePrivate: boolean;
    uniqueNames: boolean;
    rejectDateType: boolean;
    id: string;
    defaultNumberType: "number" | "integer";
    constAsEnum: boolean;
};
type PartialArgs = Partial<Args>;
type RedefinedFields = "items" | "additionalItems" | "contains" | "properties" | "patternProperties" | "additionalProperties" | "dependencies" | "propertyNames" | "if" | "then" | "else" | "allOf" | "anyOf" | "oneOf" | "not" | "definitions";
type DefinitionOrBoolean = Definition | boolean;
interface Definition extends Omit<JSONSchema7, RedefinedFields> {
    propertyOrder?: string[];
    defaultProperties?: string[];
    typeof?: "function";
    items?: DefinitionOrBoolean | DefinitionOrBoolean[];
    additionalItems?: DefinitionOrBoolean;
    contains?: JSONSchema7;
    properties?: {
        [key: string]: DefinitionOrBoolean;
    };
    patternProperties?: {
        [key: string]: DefinitionOrBoolean;
    };
    additionalProperties?: DefinitionOrBoolean;
    dependencies?: {
        [key: string]: DefinitionOrBoolean | string[];
    };
    propertyNames?: DefinitionOrBoolean;
    if?: DefinitionOrBoolean;
    then?: DefinitionOrBoolean;
    else?: DefinitionOrBoolean;
    allOf?: DefinitionOrBoolean[];
    anyOf?: DefinitionOrBoolean[];
    oneOf?: DefinitionOrBoolean[];
    not?: DefinitionOrBoolean;
    definitions?: {
        [key: string]: DefinitionOrBoolean;
    };
}
type SymbolRef = {
    name: string;
    typeName: string;
    fullyQualifiedName: string;
    symbol: ts.Symbol;
};
declare class JsonSchemaGenerator {
    private args;
    private tc;
    /**
     * Holds all symbols within a custom SymbolRef object, containing useful
     * information.
     */
    private symbols;
    /**
     * All types for declarations of classes, interfaces, enums, and type aliases
     * defined in all TS files.
     */
    private allSymbols;
    /**
     * All symbols for declarations of classes, interfaces, enums, and type aliases
     * defined in non-default-lib TS files.
     */
    private userSymbols;
    /**
     * Maps from the names of base types to the names of the types that inherit from
     * them.
     */
    private inheritingTypes;
    /**
     * This map holds references to all reffed definitions, including schema
     * overrides and generated definitions.
     */
    private reffedDefinitions;
    /**
     * This map only holds explicit schema overrides. This helps differentiate between
     * user defined schema overrides and generated definitions.
     */
    private schemaOverrides;
    /**
     * This is a set of all the user-defined validation keywords.
     */
    private userValidationKeywords;
    /**
     * If true, this makes constants be defined as enums with a single value. This is useful
     * for cases where constant values are not supported, such as OpenAPI.
     */
    private constAsEnum;
    /**
     * Types are assigned names which are looked up by their IDs.  This is the
     * map from type IDs to type names.
     */
    private typeNamesById;
    /**
     * Whenever a type is assigned its name, its entry in this dictionary is set,
     * so that we don't give the same name to two separate types.
     */
    private typeIdsByName;
    constructor(symbols: SymbolRef[], allSymbols: {
        [name: string]: ts.Type;
    }, userSymbols: {
        [name: string]: ts.Symbol;
    }, inheritingTypes: {
        [baseName: string]: string[];
    }, tc: ts.TypeChecker, args?: Args);
    get ReffedDefinitions(): {
        [key: string]: Definition;
    };
    private isFromDefaultLib;
    private resetSchemaSpecificProperties;
    /**
     * Parse the comments of a symbol into the definition and other annotations.
     */
    private parseCommentsIntoDefinition;
    private getDefinitionForRootType;
    private getReferencedTypeSymbol;
    private getDefinitionForProperty;
    private getEnumDefinition;
    private getUnionDefinition;
    private getIntersectionDefinition;
    private getClassDefinition;
    /**
     * Gets/generates a globally unique type name for the given type
     */
    private getTypeName;
    private makeTypeNameUnique;
    private recursiveTypeRef;
    private getTypeDefinition;
    setSchemaOverride(symbolName: string, schema: Definition): void;
    getSchemaForSymbol(symbolName: string, includeReffedDefinitions?: boolean, includeAllOverrides?: boolean): Definition;
    getSchemaForSymbols(symbolNames: string[], includeReffedDefinitions?: boolean, includeAllOverrides?: boolean): Definition;
    getSymbols(name?: string): SymbolRef[];
    getUserSymbols(): string[];
    getMainFileSymbols(program: ts.Program, onlyIncludeFiles?: string[]): string[];
}
export declare function buildGenerator(program: ts.Program, args?: PartialArgs): JsonSchemaGenerator | null;
export {};

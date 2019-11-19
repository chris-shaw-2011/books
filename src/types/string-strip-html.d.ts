declare module "string-strip-html" {
   export = string_strip_html;
}

declare function string_strip_html(str: string, originalOpts?: Options): string;

interface Options {
   ignoreTags?: Array<string>,
   onlyStripTags?: Array<string>,
   stripTogetherWithTheirContents?: Array<string> | false,
   skipHtmlDecoding?: boolean,
   returnRangeOnly?: boolean,
   trimOnlySpaces?: boolean,
   dumpLinkHrefsNearby: DumpLinkHrefsNearby | false,
}

interface DumpLinkHrefsNearby {
   enabled?: boolean,
   putOnNewLine?: boolean,
   wrapHeads?: string,
   wrapTails?: string,
}
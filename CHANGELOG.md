# Changelog

## [1.0.0](https://github.com/ui-layouts/mcp/compare/0.4.0...1.0.0) (2026-11-15)


### ⚠ BREAKING CHANGES

* **get_docs:** returns MDX from the source repo. The `format` and `pathPrefix` arguments are gone; a call that still passes them gets MDX.
* **get_docs:** the header has `source` in place of `url`, and the default `maxChars` is 20000.
* **get_component_meta:** the `pathPrefix` argument is gone.
* **get_source_code:** returns every file of the item, each under its path, where it returned the first file only.
* **implement_component:** an unknown or missing component is a prompt error (-32602), where it returned a "Component not found" message.

### Features

* **get_docs:** read docs from the MDX source ([#15](https://github.com/ui-layouts/mcp/issues/15)) ([afa62fb](https://github.com/ui-layouts/mcp/commit/afa62fbeb5b1dbd459ab36a2f3b55925ce95df03))
* **get_source_code:** return every file and the dependencies ([#25](https://github.com/ui-layouts/mcp/issues/25)) ([1022807](https://github.com/ui-layouts/mcp/commit/1022807033a4e94c614c6b968c5c14370bd0a1b0))
* **registry:** index every registry item and list them in get_docs ([#22](https://github.com/ui-layouts/mcp/issues/22)) ([e00fba5](https://github.com/ui-layouts/mcp/commit/e00fba5ef070f7a3c3f09c18c5a6e6fd62414ef3))
* **search:** rank search_components results and search item names ([#23](https://github.com/ui-layouts/mcp/issues/23)) ([17cef24](https://github.com/ui-layouts/mcp/commit/17cef24412351eb8372cfbf3993c62adada3efae))


### Bug Fixes

* **get_component_meta:** remove the pathPrefix argument ([#19](https://github.com/ui-layouts/mcp/issues/19)) ([89a7663](https://github.com/ui-layouts/mcp/commit/89a76633895fab229e3ae72a6d1c7653eddf3577))
* **prompts:** correct implement_component and find_component instructions ([#17](https://github.com/ui-layouts/mcp/issues/17)) ([163daee](https://github.com/ui-layouts/mcp/commit/163daeeee35d28a39f84b0ef655804dca384aa7f))
* **tools:** report why a fetch failed ([#20](https://github.com/ui-layouts/mcp/issues/20)) ([6ebd015](https://github.com/ui-layouts/mcp/commit/6ebd01537d1c60b58f5c46079f8a5abfcf760053))


### Dependencies

* bump zod from 3.25.76 to 4.6.7 ([#14](https://github.com/ui-layouts/mcp/issues/14)) ([a7cae4a](https://github.com/ui-layouts/mcp/commit/a7cae4ae0f8abf38c6d8a85601f9d973aa4b2680))
* require @modelcontextprotocol/sdk ^1.32.2 ([#18](https://github.com/ui-layouts/mcp/issues/18)) ([ba02f72](https://github.com/ui-layouts/mcp/commit/ba02f725701fb7bcace3695221bff642d01a6482))

## [0.4.0](https://github.com/ui-layouts/mcp/compare/0.3.0...0.4.0) (2026-11-04)


### Bug Fixes

* **registry:** sync component registry with ui-layouts.com ([#10](https://github.com/ui-layouts/mcp/issues/10)) ([4f56448](https://github.com/ui-layouts/mcp/commit/4f564486459ca2b835c29ead7f9a9bfb351562a6))
* **tools:** decode entities, validate inputs, flag tool errors ([#9](https://github.com/ui-layouts/mcp/issues/9)) ([6c15696](https://github.com/ui-layouts/mcp/commit/6c156964c3449cf4a8f736a071935d75c97b51a0))


### Miscellaneous Chores

* release 0.4.0 ([9c72e8e](https://github.com/ui-layouts/mcp/commit/9c72e8e7c380f440b3a54b5fd0f747dad669d1ab))

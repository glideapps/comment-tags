# Introduction

VScode extension that finds "tags" in your typescript codebase.<br>
A tag is a word such as `##test` found within comments.<br>
The extension finds such tags, creates previews of the context around the tag,<br>
and allows you to easily navigate the locations of your tags.

This extension is modelled after and is an approximation of
[this](https://www.notion.so/Hyperlinks-in-code-VSCode-extension-58245a1b19594015a05dc26643d202fc)
description.

## Sample usage
Highlight a tag and right-click, then select "Tags" from the context menu

![Demo](images/demo.gif)

## Dependencies

The extension uses the awesome [ripgrep](https://www.notion.so/Hyperlinks-in-code-VSCode-extension-58245a1b19594015a05dc26643d202fc)
to search your project. For it to work, please make sure you have it installed.
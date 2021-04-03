# Introduction

VScode extension that finds "tags" in your typescript codebase.<br>
A tag is a word such as `##test` found within comments.<br>
The extension finds such tags, creates previews of the context around the tag,<br>
and allows you to easily navigate the locations of your tags.

This extension is modelled after and is an approximation of
[this](https://www.notion.so/Hyperlinks-in-code-VSCode-extension-58245a1b19594015a05dc26643d202fc)
description.

## Sample usage

{Cmd, Ctrl}-Click on a tag to see all sites where it is used.
In the commands pallete, choose "See all Tags" to see all the tags in your project

![Demo](images/demo.gif)

## Dependencies

The extension uses the awesome [ripgrep](https://github.com/BurntSushi/ripgrep)
to search your project.<br>
For it to work, please make sure you have it installed.<br>
Ensure "rg" is in your `$PATH` or configure the absolute path to it on the extension settings (`ripgrepPath`)

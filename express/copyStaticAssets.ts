import * as shell from "shelljs";

shell.mkdir("-p", "dist/public/stylesheets");
shell.mkdir("-p", "dist/views");
shell.cp("-R", "public/stylesheets", "dist/public");
shell.cp("-R", "views", "dist");

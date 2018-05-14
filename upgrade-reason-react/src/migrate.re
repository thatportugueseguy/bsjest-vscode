open Refmt_api.Migrate_parsetree;

open Ast_404;

/* module To_current = Convert(OCaml_404, OCaml_402); */
open Ast_helper;

open Ast_mapper;

open Asttypes;

open Parsetree;

open Longident;

let iRefItBlocks = ref(0);
let iRefExpects = ref(0);

let currentFileRef = ref("");

let itBlocksMapper = {
  ...default_mapper,
  expr: (mapper, expression) =>
    switch (expression) {
    /* remove NoUpdate from didMount return */
    /* change Update & UpdateWithSideEffect to something else */
    | { pexp_desc, pexp_loc, pexp_attributes } => {
        switch (pexp_desc) {
        | Pexp_apply(pexp_desc, [(_label, {pexp_desc: Pexp_constant(Pconst_string(name, None))}), _]) => {
          switch (pexp_desc, pexp_loc) {
          | ({ pexp_desc: Pexp_ident({ txt: Lident("test") })}, _) => {
            iRefItBlocks^ == 0 ? print_endline("    {") : print_endline("    ,{");
            print_endline("      \"file\": \"" ++ currentFileRef^ ++ "\"," );
            print_endline("      \"name\": \"" ++ name ++ "\"," );
            print_string("      \"start\": [");
            print_endline(string_of_int(pexp_loc.Location.loc_start.pos_lnum) ++ ", " ++ string_of_int(pexp_loc.Location.loc_start.pos_cnum - pexp_loc.Location.loc_start.pos_bol) ++ "],");
            print_string("      \"end\": [");
            print_endline(string_of_int(pexp_loc.Location.loc_end.pos_lnum) ++ ", " ++ string_of_int(pexp_loc.Location.loc_end.pos_cnum - pexp_loc.Location.loc_end.pos_bol) ++ "]");
            print_endline("    }");
            iRefItBlocks := iRefItBlocks^ + 1;
          }
          | _ => ()
          }
        }
        | _ => ()
        };

        default_mapper.expr(mapper, { pexp_desc, pexp_loc, pexp_attributes });
      }
    /* | anythingElse => default_mapper.expr(mapper, anythingElse) */
    }
};

let expectsMapper = {
  ...default_mapper,
  expr: (mapper, expression) =>
    switch (expression) {
    | { pexp_desc, pexp_loc, pexp_attributes } => {
        switch (pexp_desc) {
        | Pexp_apply(pexp_desc, _) => {
          switch (pexp_desc, pexp_loc) {
          | ({ pexp_desc: Pexp_ident({ txt: Lident("expect") })}, _) => {
            iRefExpects^ == 0 ? print_endline("    {") : print_endline("    ,{");
            print_string("      \"start\": [");
            print_endline(string_of_int(pexp_loc.Location.loc_start.pos_lnum) ++ ", " ++ string_of_int(pexp_loc.Location.loc_start.pos_cnum - pexp_loc.Location.loc_start.pos_bol) ++ "],");
            print_string("      \"end\": [");
            print_endline(string_of_int(pexp_loc.Location.loc_end.pos_lnum) ++ ", " ++ string_of_int(pexp_loc.Location.loc_end.pos_cnum - pexp_loc.Location.loc_end.pos_bol) ++ "],");
            print_endline("    }");
            iRefExpects := iRefExpects^ + 1;
          }
          | _ => ()
          }
        }
        | _ => ()
        };

        default_mapper.expr(mapper, { pexp_desc, pexp_loc, pexp_attributes });
      }
    /* | anythingElse => default_mapper.expr(mapper, anythingElse) */
    }
};


switch (Sys.argv) {
| [||]
| [|_|]
| [|_, "help" | "-help" | "--help"|] =>
  print_endline("Usage: pass a list of .re files you'd like to convert.")
| arguments =>
  let files = Array.sub(arguments, 1, Array.length(arguments) - 1);
  files
  |> Array.iter((file) => {
       let isReason = Filename.check_suffix(file, ".re");
       /* || Filename.check_suffix(file, ".rei"); */
       /* let isOCaml =
          Filename.check_suffix(file, ".ml")
          || Filename.check_suffix(file, ".mli"); */
       if (isReason) {

         if (Sys.file_exists(file)) {
           let ic = open_in_bin(file);
           let lexbuf = Lexing.from_channel(ic);
           let (ast, comments) =
             Refmt_api.Reason_toolchain.RE.implementation_with_comments(
               lexbuf
             );

            currentFileRef := file;
            print_endline("{");
            print_endline("  \"itBlocks\": [");
            /* Should we print the file here??? */
            let _ = default_mapper.structure(itBlocksMapper, ast);
            print_endline("  ], ");
            
            print_endline("  \"expects\": [");
           let mp2 = default_mapper.structure(expectsMapper, ast); 
            print_endline("  ] ");
            print_endline("{");

           /*close_out(oc);*/
           /*
           let target = file;
           let oc = open_out_bin(target);
           let formatter = Format.formatter_of_out_channel(oc);
           Refmt_api.Reason_toolchain.RE.print_implementation_with_comments(
             formatter,
             (newAst, comments)
           );
           Format.print_flush();
           close_out(oc); */
         } else {
           print_endline(file ++ " doesn't exist. Skipped.");
         };

       };
     });
};

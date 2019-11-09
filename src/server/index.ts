import fastify from "fastify";
import fs from "fs";
import path from "path";
import Directory from "../shared/Directory"
import Book from "../shared/Book"
import fastifyStatic from "fastify-static"
import jsmediatags from "jsmediatags"
import { TagType } from "jsmediatags/types";

const server = fastify({ logger: true });
const basePath = "T:\\Audio Books";

server.register(fastifyStatic, {
   root: basePath,
   prefix: "/unused",
   serve: false,
})

server.get("/books", async (request, reply) => {
   return ((await Recursive([], "")) as Directory);
})

server.get("/files/*", (request, reply) => {
   var filePath = request.params["*"] as string;

   if (filePath.endsWith(".jpg") || filePath.endsWith(".m4b")) {
      if (filePath.endsWith(".m4b")) {
         var splitPath = filePath.split("/");

         reply.header("Content-Disposition", `attachment; filename=\"${splitPath[splitPath.length - 1]}\"`)
      }

      reply.sendFile(filePath)
   }
   else {
      reply.code(404).send("Not Found");
   }
})

async function Recursive(pathTree: string[], name: string): Promise<Directory | null> {
   var currPath = path.join(basePath, ...pathTree, name)
   var paths = await fs.promises.readdir(currPath, { withFileTypes: true });
   var newPathTree = name ? pathTree.concat(name) : pathTree;
   var dir = new Directory();

   dir.name = name;

   for (const p of paths) {
      if (p.isDirectory()) {
         var result = await Recursive(newPathTree, p.name);

         if (result) {
            dir.items.push(result)
         }
      }
      else if (p.isFile() && p.name.endsWith(".m4b")) {
         var book = new Book();
         var bookPath = path.join(currPath, p.name);
         var photoPath = bookPath + ".jpg"
         var tags = (await new Promise((resolve, error) => jsmediatags.read(bookPath, {
            onSuccess: (tags) => resolve(tags),
            onError: (e) => error(e),
         })) as TagType).tags

         console.log(tags)

         if (tags) {
            book.name = tags.title || p.name;
            book.author = tags.artist || "";
            book.year = tags.year || "";
            book.comment = tags.comment || "";

            if (tags.picture && tags.picture.data && !fs.existsSync(photoPath)) {
               fs.writeFileSync(photoPath, new Uint8Array(tags.picture.data));
            }
         }
         else {
            book.name = p.name
         }

         if (newPathTree.length) {
            book.download = `/files/${newPathTree.join("/")}/${p.name}`
         }
         else {
            book.download = `/files/${p.name}`
         }

         book.cover = book.download + ".jpg";
         book.numBytes = (await fs.promises.stat(bookPath)).size;

         dir.items.push(book);
      }
   }

   if (dir.items.length) {
      return dir;
   }
   else {
      return null;
   }
}

const start = async () => {
   try {
      await server.listen(3001)
   }
   catch (err) {
      server.log.error(err)
      process.exit(1)
   }
}

start();

export default class test {

}
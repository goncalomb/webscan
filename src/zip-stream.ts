import streamSaver from 'streamsaver';

/*
XXX: Abusing 'streamsaver/examples/zip-stream' example code!
     Current implementations of client-side streaming ZIP creation are very
     poor. '@transcend-io/conflux' is probably the only real choice, but it
     doesn't support compression and it's relatively unknown, although it
     appears to have a good amount of automated tests.
     In my infinite wisdom, I opted for abusing a 'zip-stream' example from
     'streamsaver', it also does not support compression, and it's not really
     meant for production code. Migrating to '@transcend-io/conflux' is
     probably a wise choice in the future.
*/

type ZIPEntry = {
  name: string;
  lastModified?: Date;
  comment?: string;
} & ({
  directory?: false;
  stream: () => ReadableStream;
} | {
  directory: true;
  stream: never;
});

declare global {
  interface Window {
    ZIP?: (underlyingSource: Pick<UnderlyingDefaultSource<ZIPEntry>, 'start' | 'pull'>) => ReadableStream<ZIPEntry>
  }
}

// XXX: abuse starts here
// import ZIP from 'streamsaver/examples/zip-stream';
require('streamsaver/examples/zip-stream');
if (!window.ZIP) {
  console.error("Error preparing zip-stream.");
}
export const createZipStream = window.ZIP!;
delete window.ZIP;

/*
XXX: Proxy 'streamSaver.createWriteStream' to create credentialless iframes!
     This is required because we are using COEP and 'streamsaver' uses an
     iframe with a remote src (different origin). This is a limitation of
     the library ('streamsaver' could be fixed to support it).
     It works by permanently proxying 'document.createElement' to
     intercept iframe creation and injecting the 'credentialless' attribute.
     Performance impact should be negligent.
*/

const documentCE = document.createElement;
const streamSaverCWS = streamSaver.createWriteStream;
streamSaver.createWriteStream = (...args: Parameters<typeof streamSaver.createWriteStream>) => {
  if (document.createElement === documentCE) {
    document.createElement = (...args: Parameters<Document['createElement']>) => {
      const el = documentCE.apply(document, args);
      if (args[0] === 'iframe') {
        el.setAttribute('credentialless', '');
      }
      return el;
    };
  }
  return streamSaverCWS(...args);
};

export { streamSaver };

/**
 * Main utility function to create ZIP files (streaming).
 * @param filename download name
 * @param pull callback function for providing ZIP entries
 * @returns progress promise
 */
export function saveZipAs(filename: string, pull: () => PromiseLike<ZIPEntry | null> | null) {
  const fileStream = streamSaver.createWriteStream(filename);
  const zipStream = createZipStream({
    pull: async (ctrl) => {
      const value = await pull();
      if (value) {
        ctrl.enqueue(value);
      } else {
        ctrl.close();
      }
    },
  });
  return zipStream.pipeTo(fileStream);
}

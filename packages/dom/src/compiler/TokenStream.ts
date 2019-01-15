import { InputStreamClass } from './InputStream';

// indent | tag | classes | id | attributeStart | (attributeName, attributeContent) | attributeEnd | textSeparator | textContent

// TODO: Add debug information for each token (line number, col number, etc)

// TODO: Don't fail on error but return an ERROR Token that will be used by the
// parser to create an error element which will show the developer in-dom
// both the error message and the erroring element without affecting the
// rest of the template

// TODO: Ensure that the tokenizer never gets into an infinite loop

// TODO: Define an error code index

// TODO: Allow comment block on the same line as content ` div // this will foobar `
// this only works if the first 2 chars in the content area are a slash - the user should
// escape them ` div \// this will be shown `

// TODO: Allow block comments /* ... */

// TODO: After | ignore all white spaces until content

// TODO: Tokenize the content if {{ }} is encountered:
// `div foo {{ bar }} baz` becomes:
// `div
//    span foo&nbsp; // preserving white space
//    span {{ bar }} // the content will be replaced entirely with dynamic content
//    span &nbsp;baz // keeping white space accordingly

export interface TokenInterface {
  type: string;
  value?: any;
}

export class TokenStreamClass {
  private input: InputStreamClass;
  private matchTag = /[a-z0-9\-]/;
  private matchCSSClass = /[a-zA-Z0-9]/;
  private matchCSSId = /[a-zA-Z0-9]/;
  private matchAttributeName = /[a-z\-]/;
  private current: TokenInterface | null = null;
  private readingAttributes = false;
  private readingPipe = false;
  private readSofIndent = false;
  private _infiniteLoopWatcher: number = 0;

  set infiniteLoopWatcher(inc: number) {
    this._infiniteLoopWatcher += 1;
    if (this._infiniteLoopWatcher > 500) {
      throw new Error('Loop limit reached');
    }
  }
  get infiniteLoopWatcher() {
    return this._infiniteLoopWatcher;
  }

  constructor(input: InputStreamClass) {
    this.input = input;
  }

  next(): TokenInterface | null {
    const tok = this.current;
    this.current = null;
    return tok || this.readNext();
  }
  peek(): TokenInterface | null {
    return this.current || (this.current = this.readNext());
  }
  eof(): boolean {
    return this.peek() === null;
  }
  run(): TokenInterface[] {
    const tokens: TokenInterface[] = [];
    while (!this.eof()) {
      const token = this.next();
      if (token !== null) {
        tokens.push(token);
      }
      this.infiniteLoopWatcher += 1;
    }
    return tokens;
  }
  error() {}

  private readNext(): TokenInterface | null {
    this.infiniteLoopWatcher += 1;
    if (this.input.eof()) return null;
    let ch = this.input.peek();

    if (this.input.sof() && !this.readSofIndent) {
      this.readSofIndent = true;
      return this.readIndent();
    }

    if (ch === '\n') {
      if (this.readingPipe) {
        this.readingPipe = false;
      }
      this.readWhile(this.isEOL);
      return this.readIndent();
    }
    if (this.isPipeStart(ch)) {
      this.readingPipe = true;
      this.input.next();
      return this.readPipe();
    }
    if (this.isAttributesStart(ch)) {
      if (this.readingAttributes) {
        this.input.error('Open attributes char "(" was found inside an attribute definition.');
      }
      this.readingAttributes = true;
      ch = this.input.peek();
      if (ch === '') {
        return null;
      }
    }
    if (this.isAttributeEnd(ch)) {
      this.readingAttributes = false;
      this.input.next();
      ch = this.input.peek();
      if (ch === '') {
        return null;
      }
    }
    if (this.readingAttributes) {
      this.readWhile(x => !/[a-z]/.test(x));
      return this.readAttribute();
    }
    if (this.isTagStart(ch) && !this.readingPipe) {
      return this.readTag();
    }
    if (this.isClassStart(ch)) {
      // skip class indicator
      this.input.next();
      return this.readClass();
    }
    if (this.isIdStart(ch)) {
      // skip id separator
      this.input.next();
      return this.readId();
    }
    if (this.isContentStart(ch)) {
      // skip content separator
      this.input.next();
      return this.readContent();
    }
    if (this.readingPipe) {
      return this.readContent();
    }
    this.input.error(`Can't recognize char "${ch}"`);
    return null;
  }

  private readWhile(predicate): string {
    let str = '';
    while (!this.input.eof() && predicate(this.input.peek())) {
      str += this.input.next();
    }
    return str;
  }

  private isEOL(ch): boolean {
    return ch === '\n';
  }
  private isPipeStart(ch): boolean {
    return ch === '|';
  }
  private isWhiteSpace(ch): boolean {
    return /\s/.test(ch);
  }
  private isIndent(ch): boolean {
    return /\s/.test(ch);
  }
  private isIdStart(ch): boolean {
    return ch === '#';
  }
  private isTagStart(ch): boolean {
    return /[a-z]/.test(ch);
  }
  private isContentStart(ch): boolean {
    return /\s/.test(ch);
  }
  private isAttributesStart(ch): boolean {
    return ch === '(';
  }
  private isAttributeEnd(ch): boolean {
    return ch === ')';
  }
  private isClassStart(ch): boolean {
    return ch === '.';
  }

  private readTag(): TokenInterface {
    let tag = this.readWhile(x => this.matchTag.test(x));
    return {
      type: 'tag',
      value: tag,
    };
  }
  private readPipe(): TokenInterface {
    this.readWhile(this.isWhiteSpace);
    return {
      type: 'pipe',
    };
  }

  private readContent(): TokenInterface {
    let content = this.readWhile(x => x !== '\n');
    return {
      type: 'content',
      value: content,
    };
  }
  private readId(): TokenInterface {
    let id = this.readWhile(x => this.matchCSSId.test(x));
    // TODO: Verify that the id is valid
    return {
      type: 'id',
      value: id,
    };
  }
  private readClass(): TokenInterface {
    let className = this.readWhile(x => this.matchCSSClass.test(x));
    return {
      type: 'class',
      value: className,
    };
  }
  private readAttribute(): TokenInterface {
    let attributeName = this.readWhile(x => this.matchAttributeName.test(x));
    let ch = this.input.peek();
    let value;
    if (ch === '=') {
      this.input.next();
      ch = this.input.peek();
      if (ch !== '"') {
        this.input.error('Expecting " to begin attribute value');
      }
      // Remove the first quotes
      this.input.next();
      value = this.readWhile(x => {
        return (x !== '"' || (x === '"' && this.input.peekPrev() === '\\')) && x !== '\n';
      });
      if (this.input.peek() == '\n' || this.input.eof()) {
        this.input.error(
          'Reached the end of the line without finding a matching """ to close the attribute.'
        );
      }
      // Remove the last quotes
      this.input.next();
    } else {
      value = null;
    }
    return {
      type: 'attribute',
      value: {
        name: attributeName,
        value: value,
      },
    };
  }
  private readIndent() {
    let indent = this.readWhile(x => this.isIndent(x));
    return {
      type: 'newLineIndent',
      value: indent.length,
    };
  }
}

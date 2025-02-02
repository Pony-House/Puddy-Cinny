/* eslint-disable no-param-reassign */
/* eslint-disable no-use-before-define */
import hljs from 'highlight.js';
import moment from 'moment-timezone';
import SimpleMarkdown from '@khanacademy/simple-markdown';
import { idRegex, parseIdUri } from './common';

moment.locale('en');
const timestampFormats = {

  t: `hh:mm A`,
  T: `hh:mm:ss A`,

  d: `MM/DD/YYYY`,
  D: `MMMM DD, YYYY`,

  f: `MMMM DD, YYYY hh:mm A`,
  F: `dddd MMMM DD, YYYY hh:mm A`,

  html: (item, fromNow = false) => ({

    order: defaultRules.inlineCode.order + 0.1,
    match: inlineRegex(new RegExp(`^<t:(.*):${item}>`, 'g')),

    parse: (capture, parse, state) => ({
      content: parse(capture[1], state)
    }),

    plain: (node, output, state) => `<t:${output(node.content, state)}:${item}>`,
    html: (node, output, state) => {

      const timestamp = Number(output(node.content, state)) * 1000;

      return htmlTag(
        'span',
        (!fromNow ? moment(timestamp).format(timestampFormats[item]) : moment(timestamp).fromNow()),
        { 'data-mx-timestamp': String(timestamp), 'timestamp-type': item },
      );

    },

  })

};

setInterval(() => {
  const timestamps = Array.from(document.querySelectorAll('[data-mx-timestamp]'));
  if (timestamps.length > 0) {
    timestamps.map(item => {

      const type = item.getAttribute('timestamp-type');
      const timestamp = Number(item.getAttribute('data-mx-timestamp'));

      if (!Number.isNaN(timestamp) && typeof type === 'string') {
        if (type !== 'R') {
          item.innerHTML = moment(timestamp).format(timestampFormats[type]);
        } else {
          item.innerHTML = moment(timestamp).fromNow();
        }
      }

      return item;

    })
  }
}, 1000);

const {
  defaultRules, parserFor, outputFor, anyScopeRegex, blockRegex, inlineRegex,
  sanitizeText, sanitizeUrl,
} = SimpleMarkdown;

function htmlTag(tagName, content, attributes, isClosed) {
  let s = '';
  Object.entries(attributes || {}).forEach(([k, v]) => {
    if (v !== undefined) {
      s += ` ${sanitizeText(k)}`;
      if (v !== null) s += `="${sanitizeText(v)}"`;
    }
  });

  s = `<${tagName}${s}>`;

  if (isClosed === false) {
    return s;
  }
  return `${s}${content}</${tagName}>`;
}

function mathHtml(wrap, node) {
  return htmlTag(wrap, htmlTag('code', sanitizeText(node.content)), { 'data-mx-maths': node.content });
}

const emojiRegex = /^:([\w-]+):/;

const plainRules = {
  Array: {
    ...defaultRules.Array,
    plain: defaultRules.Array.html,
  },
  userMention: {
    order: defaultRules.em.order - 0.9,
    match: inlineRegex(idRegex('@', undefined, '^')),
    parse: (capture, _, state) => ({
      type: 'mention',
      content: state.userNames[capture[1]] ? `@${state.userNames[capture[1]]}` : capture[1],
      id: capture[1],
    }),
  },
  roomMention: {
    order: defaultRules.em.order - 0.8,
    match: inlineRegex(idRegex('#', undefined, '^')),
    parse: (capture) => ({ type: 'mention', content: capture[1], id: capture[1] }),
  },
  mention: {
    plain: (node, _, state) => (state.kind === 'edit' ? node.id : node.content),
    html: (node) => htmlTag('a', sanitizeText(node.content), {
      href: `https://matrix.to/#/${encodeURIComponent(node.id)}`,
    }),
  },
  emoji: {
    order: defaultRules.em.order - 0.1,
    match: (source, state) => {
      if (!state.inline) return null;
      const capture = emojiRegex.exec(source);
      if (!capture) return null;
      const emoji = state.emojis.get(capture[1]);
      if (emoji) return capture;
      return null;
    },
    parse: (capture, _, state) => ({ content: capture[1], emoji: state.emojis.get(capture[1]) }),
    plain: ({ emoji }) => (emoji.mxc
      ? `:${emoji.shortcode}:`
      : emoji.unicode),
    html: ({ emoji }) => (emoji.mxc
      ? htmlTag('img', null, {
        'data-mx-emoticon': null,
        src: emoji.mxc,
        alt: `:${emoji.shortcode}:`,
        title: `:${emoji.shortcode}:`,
        height: 32,
      }, false)
      : emoji.unicode),
  },
  newline: {
    ...defaultRules.newline,
    plain: () => '\n',
  },
  paragraph: {
    ...defaultRules.paragraph,
    plain: (node, output, state) => `${output(node.content, state)}\n\n`,
    html: (node, output, state) => htmlTag('p', output(node.content, state)),
  },
  escape: {
    ...defaultRules.escape,
    plain: (node, output, state) => `\\${output(node.content, state)}`,
  },
  br: {
    ...defaultRules.br,
    match: anyScopeRegex(/^ *\n/),
    plain: () => '\n',
  },
  text: {
    ...defaultRules.text,
    match: anyScopeRegex(/^[\s\S]+?(?=[^0-9A-Za-z\s\u00c0-\uffff]| *\n|\w+:\S|$)/),
    plain: (node, _, state) => (state.kind === 'edit'
      ? node.content.replace(/(\*|_|!\[|\[|\|\||\$\$?)/g, '\\$1')
      : node.content),
  },
};

const markdownRules = {

  // Default
  ...defaultRules,
  ...plainRules,

  // Heading
  heading: {
    ...defaultRules.heading,
    match: blockRegex(/^ *(#{1,6})([^\n:]*?(?: [^\n]*?)?)#* *(?:\n *)*\n/),
    plain: (node, output, state) => {
      const out = output(node.content, state);
      if (state.kind === 'edit' || state.kind === 'notification' || node.level > 2) {
        return `${'#'.repeat(node.level)} ${out}\n\n`;
      }
      return `${out}\n${(node.level === 1 ? '=' : '-').repeat(out.length)}\n\n`;
    },
  },

  // HR Separator
  hr: {
    ...defaultRules.hr,
    plain: () => '---\n\n',
  },

  // Code Block
  codeBlock: {
    ...defaultRules.codeBlock,
    plain: (node) => `\`\`\`${node.lang || ''}\n${node.content}\n\`\`\`\n`,
    html: (node) => {

      const autoCode = () => {
        const tinyCode = hljs.highlightAuto(node.content);
        return `<pre><code class='language-${tinyCode.language} hljs'>${tinyCode.value}</code></pre>`;
      };

      if (!node.lang) { return autoCode(); }

      const langs = hljs.listLanguages();
      if (langs.indexOf(node.lang) > -1) {
        return `<pre><code class='language-${node.lang} hljs'>${hljs.highlight(node.content, { language: node.lang }).value}</code></pre>`;
      }

      return autoCode();

    },
  },

  // Fence
  fence: {
    ...defaultRules.fence,
    match: blockRegex(/^ *(`{3,}|~{3,}) *(?:(\S+) *)?\n([\s\S]+?)\n?\1 *(?:\n *)*\n/),
  },

  // Block Quote
  blockQuote: {
    ...defaultRules.blockQuote,
    plain: (node, output, state) => `> ${output(node.content, state).trim().replace(/\n/g, '\n> ')}\n\n`,
  },

  // List
  list: {
    ...defaultRules.list,
    plain: (node, output, state) => {
      const oldList = state._list;
      state._list = true;

      let items = node.items.map((item, i) => {
        const prefix = node.ordered ? `${node.start + i}. ` : '* ';
        return prefix + output(item, state).replace(/\n/g, `\n${' '.repeat(prefix.length)}`);
      }).join('\n');

      state._list = oldList;

      if (!state._list) {
        items += '\n\n';
      }
      return items;
    },
  },

  // ???
  def: undefined,

  // Table
  table: {
    ...defaultRules.table,
    plain: (node, output, state) => {
      const header = node.header.map((content) => output(content, state));

      const colWidth = node.align.map((align) => {
        switch (align) {
          case 'left':
          case 'right':
            return 2;
          case 'center':
            return 3;
          default:
            return 1;
        }
      });
      header.forEach((s, i) => {
        if (s.length > colWidth[i]) colWidth[i] = s.length;
      });

      const cells = node.cells.map((row) => row.map((content, i) => {
        const s = output(content, state);
        if (colWidth[i] === undefined || s.length > colWidth[i]) {
          colWidth[i] = s.length;
        }
        return s;
      }));

      function pad(s, i) {
        switch (node.align[i]) {
          case 'right':
            return s.padStart(colWidth[i]);
          case 'center':
            return s
              .padStart(s.length + Math.floor((colWidth[i] - s.length) / 2))
              .padEnd(colWidth[i]);
          default:
            return s.padEnd(colWidth[i]);
        }
      }

      const line = colWidth.map((len, i) => {
        switch (node.align[i]) {
          case 'left':
            return `:${'-'.repeat(len - 1)}`;
          case 'center':
            return `:${'-'.repeat(len - 2)}:`;
          case 'right':
            return `${'-'.repeat(len - 1)}:`;
          default:
            return '-'.repeat(len);
        }
      });

      const table = [
        header.map(pad),
        line,
        ...cells.map((row) => row.map(pad))];

      return table.map((row) => `| ${row.join(' | ')} |\n`).join('');
    },
  },

  // Display Math
  displayMath: {
    order: defaultRules.table.order + 0.1,
    match: blockRegex(/^ *\$\$ *\n?([\s\S]+?)\n?\$\$ *(?:\n *)*\n/),
    parse: (capture) => ({ content: capture[1] }),
    plain: (node) => (node.content.includes('\n')
      ? `$$\n${node.content}\n$$\n`
      : `$$${node.content}$$\n`),
    html: (node) => mathHtml('div', node),
  },

  // Shrug
  shrug: {
    order: defaultRules.escape.order - 0.1,
    match: inlineRegex(/^¯\\_\(ツ\)_\/¯/),
    parse: (capture) => ({ type: 'text', content: capture[0] }),
  },

  // Table Separator
  tableSeparator: {
    ...defaultRules.tableSeparator,
    plain: () => ' | ',
  },

  // Link
  link: {
    ...defaultRules.link,
    plain: (node, output, state) => {
      const out = output(node.content, state);
      const target = sanitizeUrl(node.target) || '';
      if (out !== target || node.title) {
        return `[${out}](${target}${node.title ? ` "${node.title}"` : ''})`;
      }
      return out;
    },
    html: (node, output, state) => {
      const out = output(node.content, state);
      const target = sanitizeUrl(node.target) || '';
      if (out !== target || node.title) {
        return htmlTag('a', out, {
          href: target,
          title: node.title,
        });
      }
      return target;
    },
  },

  // Image
  image: {
    ...defaultRules.image,
    plain: (node) => `![${node.alt}](${sanitizeUrl(node.target) || ''}${node.title ? ` "${node.title}"` : ''})`,
    html: (node) => htmlTag('img', '', {
      src: sanitizeUrl(node.target) || '',
      alt: node.alt,
      title: node.title,
    }, false),
  },

  // Ref
  reflink: undefined,
  refimage: undefined,

  // Others
  em: {
    ...defaultRules.em,
    plain: (node, output, state) => `_${output(node.content, state)}_`,
  },
  strong: {
    ...defaultRules.strong,
    plain: (node, output, state) => `**${output(node.content, state)}**`,
  },
  u: {
    ...defaultRules.u,
    plain: (node, output, state) => `__${output(node.content, state)}__`,
  },
  del: {
    ...defaultRules.del,
    plain: (node, output, state) => `~~${output(node.content, state)}~~`,
  },

  // Inline Code
  inlineCode: {
    ...defaultRules.inlineCode,
    match: inlineRegex(/^(`+)([^\n]*?[^`\n])\1(?!`)/g),
    plain: (node) => `\`${node.content}\``,
  },

  // Spoiler
  spoiler: {
    order: defaultRules.inlineCode.order + 0.1,
    match: inlineRegex(/^\|\|([\s\S]+?)\|\|(?:\(([\s\S]+?)\))?/g),
    parse: (capture, parse, state) => ({
      content: parse(capture[1], state),
      reason: capture[2],
    }),
    plain: (node, output, state) => {
      const warning = `spoiler${node.reason ? `: ${node.reason}` : ''}`;
      switch (state.kind) {
        case 'edit':
          return `||${output(node.content, state)}||${node.reason ? `(${node.reason})` : ''}`;
        case 'notification':
          return `<${warning}>`;
        default:
          return `[${warning}](${output(node.content, state)})`;
      }
    },
    html: (node, output, state) => htmlTag(
      'span',
      output(node.content, state),
      { 'data-mx-spoiler': node.reason || null },
    ),
  },

  // Timestamp
  timestamp_t: timestampFormats.html('t'),
  timestamp_T: timestampFormats.html('T'),
  timestamp_d: timestampFormats.html('d'),
  timestamp_D: timestampFormats.html('D'),
  timestamp_f: timestampFormats.html('f'),
  timestamp_F: timestampFormats.html('F'),
  timestamp_R: timestampFormats.html('R', true),

  // Math
  inlineMath: {
    order: defaultRules.del.order + 0.2,
    match: inlineRegex(/^\$(\S[\s\S]+?\S|\S)\$(?!\d)/g),
    parse: (capture) => ({ content: capture[1] }),
    plain: (node) => `$${node.content}$`,
    html: (node) => mathHtml('span', node),
  },

};

// Convert Code back to script
function mapElement(el) {
  switch (el.tagName) {
    case 'MX-REPLY':
      return [];

    case 'P':
      return [{ type: 'paragraph', content: mapChildren(el) }];
    case 'BR':
      return [{ type: 'br' }];

    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return [{ type: 'heading', level: Number(el.tagName[1]), content: mapChildren(el) }];
    case 'HR':
      return [{ type: 'hr' }];
    case 'PRE': {
      let lang;
      if (el.firstChild) {
        Array.from(el.firstChild.classList).some((c) => {
          const langPrefix = 'language-';
          if (c.startsWith(langPrefix)) {
            lang = c.slice(langPrefix.length);
            return true;
          }
          return false;
        });
      }
      return [{ type: 'codeBlock', lang, content: el.innerText }];
    }
    case 'BLOCKQUOTE':
      return [{ type: 'blockQuote', content: mapChildren(el) }];
    case 'UL':
      return [{ type: 'list', items: Array.from(el.childNodes).map(mapNode) }];
    case 'OL':
      return [{
        type: 'list',
        ordered: true,
        start: Number(el.getAttribute('start')),
        items: Array.from(el.childNodes).map(mapNode),
      }];
    case 'TABLE': {
      const headerEl = Array.from(el.querySelector('thead > tr').childNodes);
      const align = headerEl.map((childE) => childE.style['text-align']);
      return [{
        type: 'table',
        header: headerEl.map(mapChildren),
        align,
        cells: Array.from(el.querySelectorAll('tbody > tr')).map((rowEl) => Array.from(rowEl.childNodes).map((childEl, i) => {
          if (align[i] === undefined) align[i] = childEl.style['text-align'];
          return mapChildren(childEl);
        })),
      }];
    }
    case 'A': {
      const href = el.getAttribute('href');

      const id = parseIdUri(href);
      if (id) return [{ type: 'mention', content: el.innerText, id }];

      return [{
        type: 'link',
        target: el.getAttribute('href'),
        title: el.getAttribute('title'),
        content: mapChildren(el),
      }];
    }
    case 'IMG': {
      const src = el.getAttribute('src');
      let title = el.getAttribute('title');
      if (el.hasAttribute('data-mx-emoticon')) {
        if (title.length > 2 && title.startsWith(':') && title.endsWith(':')) {
          title = title.slice(1, -1);
        }
        return [{
          type: 'emoji',
          content: title,
          emoji: {
            mxc: src,
            shortcode: title,
          },
        }];
      }

      return [{
        type: 'image',
        alt: el.getAttribute('alt'),
        target: src,
        title,
      }];
    }
    case 'EM':
    case 'I':
      return [{ type: 'em', content: mapChildren(el) }];
    case 'STRONG':
    case 'B':
      return [{ type: 'strong', content: mapChildren(el) }];
    case 'U':
      return [{ type: 'u', content: mapChildren(el) }];
    case 'DEL':
    case 'STRIKE':
      return [{ type: 'del', content: mapChildren(el) }];
    case 'CODE':
      return [{ type: 'inlineCode', content: el.innerText }];

    case 'DIV':
      if (el.hasAttribute('data-mx-maths')) {
        return [{ type: 'displayMath', content: el.getAttribute('data-mx-maths') }];
      }
      return mapChildren(el);
    case 'SPAN':

      if (el.hasAttribute('data-mx-spoiler')) {
        return [{ type: 'spoiler', reason: el.getAttribute('data-mx-spoiler'), content: mapChildren(el) }];
      }

      if (el.hasAttribute('data-mx-maths')) {
        return [{ type: 'inlineMath', content: el.getAttribute('data-mx-maths') }];
      }

      return mapChildren(el);

    default:
      return mapChildren(el);
  }
}

function mapNode(n) {
  switch (n.nodeType) {
    case Node.TEXT_NODE:
      return [{ type: 'text', content: n.textContent }];
    case Node.ELEMENT_NODE:
      return mapElement(n);
    default:
      return [];
  }
}

function mapChildren(n) {
  return Array.from(n.childNodes).reduce((ast, childN) => {
    ast.push(...mapNode(childN));
    return ast;
  }, []);
}

function render(content, state, plainOut, htmlOut) {
  let c = content;
  if (content.length === 1 && content[0].type === 'paragraph') {
    c = c[0].content;
  }

  const plainStr = plainOut(c, state).trim();
  if (state.onlyPlain) return { plain: plainStr };

  const htmlStr = htmlOut(c, state);

  const plainHtml = htmlStr.replace(/<br>/g, '\n').replace(/<\/p><p>/g, '\n\n').replace(/<\/?p>/g, '');
  const onlyPlain = sanitizeText(plainStr) === plainHtml;

  return {
    onlyPlain,
    plain: plainStr,
    html: htmlStr,
  };
}

const plainParser = parserFor(plainRules);
const plainPlainOut = outputFor(plainRules, 'plain');
const plainHtmlOut = outputFor(plainRules, 'html');

const mdParser = parserFor(markdownRules);
const mdPlainOut = outputFor(markdownRules, 'plain');
const mdHtmlOut = outputFor(markdownRules, 'html');

export function plain(source, state) {
  return render(plainParser(source, state), state, plainPlainOut, plainHtmlOut);
}

export function markdown(source, state) {
  return render(mdParser(source, state), state, mdPlainOut, mdHtmlOut);
}

export function html(source, state) {
  const el = document.createElement('template');
  el.innerHTML = source;
  return render(mapChildren(el.content), state, mdPlainOut, mdHtmlOut);
}

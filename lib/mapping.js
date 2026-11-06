/**
 * Fonctions pures de mise en forme des données EcoleDirecte.
 * Aucune dépendance aux API Chrome : ce module est testable avec Node.
 */

export const EXPORT_FORMAT_VERSION = "1.0.0";

const ENTITY_MAP = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  laquo: "«", raquo: "»", deg: "°", euro: "€", pound: "£", copy: "©", reg: "®", trade: "™",
  times: "×", divide: "÷", plusmn: "±", frac12: "½", frac14: "¼", frac34: "¾",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ",
  ccedil: "ç", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø", oelig: "œ",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý", yuml: "ÿ", szlig: "ß",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å", AElig: "Æ",
  Ccedil: "Ç", Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
  Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï",
  Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", Oslash: "Ø", OElig: "Œ",
  Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý"
};

export function buildExport({
  identity = {},
  notes = null,
  cahier = null,
  dayDetails = {},
  messages = null,
  messageDetails = [],
  workspaces = null,
  workspaceTrees = {},
  exportedAt = new Date().toISOString(),
  warnings = []
} = {}) {
  const notesData = notes?.data || {};
  const cahierData = cahier?.data || {};
  const workspacesData = Array.isArray(workspaces?.data) ? workspaces.data : [];
  const details = Array.isArray(messageDetails) && messageDetails.length
    ? messageDetails
    : summariesFromMessages(messages);

  return {
    eleve: mapStudent(identity, dayDetails, exportedAt, warnings),
    notes: mapNotes(notesData),
    devoirs: mapHomework(cahierData, dayDetails),
    messages: mapMessages(details),
    espace_de_travail: mapWorkspaces(workspacesData, workspaceTrees)
  };
}

export function mapStudent(identity = {}, dayDetails = {}, exportedAt = new Date().toISOString(), warnings = []) {
  const classInfo = findClassInfo(dayDetails);
  const allWarnings = [];
  if (!identity.nom) allWarnings.push("Le nom de l'élève n'a pas pu être lu depuis la page EcoleDirecte.");
  if (!identity.etablissement) allWarnings.push("L'établissement n'a pas pu être lu depuis la page EcoleDirecte.");
  if (!classInfo.libelle && !identity.classe) allWarnings.push("La classe n'a pas pu être déterminée.");
  allWarnings.push("Les messages de la boîte de réception ont été ouverts pour récupérer leur contenu : ils peuvent apparaître comme lus dans EcoleDirecte.");
  for (const warning of warnings) if (warning) allWarnings.push(String(warning));

  return {
    id: toNumber(identity.studentId) ?? identity.studentId ?? null,
    nom: identity.nom || null,
    etablissement: identity.etablissement || null,
    classe: classInfo.libelle || identity.classe || null,
    code_classe: classInfo.code || null,
    exporte_le: exportedAt,
    source: "EcoleDirecte",
    format_version: EXPORT_FORMAT_VERSION,
    avertissements: [...new Set(allWarnings)]
  };
}

function findClassInfo(dayDetails = {}) {
  for (const day of Object.values(dayDetails || {})) {
    const subjects = day?.data?.matieres;
    if (!Array.isArray(subjects)) continue;
    for (const subject of subjects) {
      if (subject?.entityLibelle || subject?.entityCode) {
        return {
          libelle: subject.entityLibelle || null,
          code: subject.entityCode || null
        };
      }
    }
  }
  return { libelle: null, code: null };
}

export function mapNotes(notesData = {}) {
  const periods = Array.isArray(notesData.periodes) ? notesData.periodes : [];
  const periodByCode = new Map();
  for (const period of periods) {
    const code = period?.codePeriode || period?.idPeriode;
    if (code) periodByCode.set(String(code), period);
  }

  const notes = Array.isArray(notesData.notes) ? notesData.notes : [];
  return notes.map((grade) => {
    const period = periodByCode.get(String(grade.codePeriode || ""));
    const note = toNumber(grade.valeur);
    const bareme = toNumber(grade.noteSur);
    const noteSur20 = note !== null && bareme !== null && bareme > 0
      ? round(note * 20 / bareme, 2)
      : null;

    return {
      id: grade.id ?? null,
      matiere: grade.libelleMatiere || grade.codeMatiere || "",
      note: grade.valeur ?? null,
      bareme,
      note_sur_20: noteSur20,
      coefficient: toNumber(grade.coef),
      intitule: grade.devoir || "",
      date: grade.date || null,
      periode: period?.periode || grade.codePeriode || null,
      code_periode: grade.codePeriode || null,
      type: grade.typeDevoir || null,
      commentaire: grade.commentaire || null,
      en_lettre: toBool(grade.enLettre),
      non_significatif: toBool(grade.nonSignificatif),
      moyenne_classe: toNumber(grade.moyenneClasse),
      note_min_classe: toNumber(grade.minClasse),
      note_max_classe: toNumber(grade.maxClasse)
    };
  }).sort((a, b) => {
    const byDate = String(a.date || "").localeCompare(String(b.date || ""));
    return byDate || String(a.matiere).localeCompare(String(b.matiere), "fr");
  });
}

export function mapHomework(cahierData = {}, dayDetails = {}) {
  const detailById = new Map();
  for (const [date, day] of Object.entries(dayDetails || {})) {
    const subjects = day?.data?.matieres;
    if (!Array.isArray(subjects)) continue;
    for (const subject of subjects) {
      const raw = subject?.aFaire;
      if (!raw) continue;
      const entries = Array.isArray(raw) ? raw : [raw];
      for (const homework of entries) {
        if (!homework || homework.idDevoir === undefined || homework.idDevoir === null) continue;
        detailById.set(String(homework.idDevoir), { homework, subject, date });
      }
    }
  }

  const assignments = [];
  for (const [date, list] of Object.entries(cahierData || {})) {
    if (!Array.isArray(list)) continue;
    for (const assignment of list) {
      if (!assignment || typeof assignment !== "object") continue;
      const detail = detailById.get(String(assignment.idDevoir));
      const homework = detail?.homework;
      const html = sanitizeHtml(decodeBase64Utf8(homework?.contenu || ""));
      const description = htmlToText(html);
      const tags = normalizeTags(assignment.tags).concat(normalizeTags(homework?.tags));

      assignments.push({
        id: assignment.idDevoir ?? null,
        date_limite: date,
        matiere: assignment.matiere || detail?.subject?.matiere || "",
        description,
        description_html: html || null,
        statut: toBool(assignment.effectue) ? "fait" : "à faire",
        effectue: toBool(assignment.effectue),
        a_faire: toBool(assignment.aFaire),
        donne_le: assignment.donneLe || homework?.donneLe || null,
        interrogation: toBool(assignment.interrogation) || toBool(detail?.subject?.interrogation),
        rendre_en_ligne: toBool(assignment.rendreEnLigne) || toBool(homework?.rendreEnLigne),
        documents_a_faire: toBool(assignment.documentsAFaire),
        pieces_jointes: collectAttachmentNames(homework?.documents, homework?.ressourceDocuments),
        tags: [...new Set(tags)],
        detail_disponible: Boolean(homework)
      });
    }
  }

  return assignments.sort((a, b) => {
    const byDate = String(a.date_limite || "").localeCompare(String(b.date_limite || ""));
    return byDate || String(a.matiere).localeCompare(String(b.matiere), "fr");
  });
}

export function mapMessages(messageDetails = []) {
  const items = Array.isArray(messageDetails) ? messageDetails : [];
  const mapped = items.map((entry) => {
    const summary = entry?.summary || {};
    const detail = entry?.detail || null;
    const rawContent = detail?.content || summary?.content || "";
    const html = sanitizeHtml(decodeBase64Utf8(rawContent));
    const content = htmlToText(html);
    const from = detail?.from || summary?.from || null;

    return {
      id: detail?.id ?? summary?.id ?? null,
      date: detail?.date || summary?.date || null,
      expediteur: formatPerson(from),
      sujet: detail?.subject || summary?.subject || "",
      contenu: content,
      contenu_html: html || null,
      lu: toBool(detail?.read ?? summary?.read),
      boite: "reception",
      pieces_jointes: collectAttachmentNames(detail?.files, summary?.files),
      contenu_disponible: Boolean(content),
      ...(entry?.error ? { erreur: String(entry.error) } : {})
    };
  });

  return mapped.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function mapWorkspaces(workspacesData = [], workspaceTrees = {}) {
  const list = Array.isArray(workspacesData) ? workspacesData : [];
  return list.map((workspace) => {
    const tree = workspaceTrees?.[workspace.id] ?? workspaceTrees?.[String(workspace.id)] ?? null;
    const arborescence = mapCloudTree(tree);
    const counts = countTree(arborescence);

    return {
      id: workspace.id ?? null,
      nom: workspace.titre || `Espace ${workspace.id ?? ""}`.trim(),
      description: decodeBase64Field(workspace.resume || "") || workspace.description || "",
      type: workspace.type || null,
      membre: toBool(workspace.estMembre),
      admin: toBool(workspace.estAdmin),
      acces_ouvert: toBool(workspace.ouvert),
      cloud: toBool(workspace.cloud),
      arborescence_disponible: Boolean(tree),
      nb_dossiers: counts.folders,
      nb_fichiers: counts.files,
      arborescence
    };
  }).sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
}

export function mapCloudTree(root) {
  if (!root || typeof root !== "object") return [];
  const children = Array.isArray(root.children) ? root.children : [];
  return children.map(mapCloudNode).filter(Boolean);
}

function mapCloudNode(node) {
  if (!node || typeof node !== "object") return null;
  if (isTruthyFlag(node.isTrash) || isTruthyFlag(node.hidden)) return null;

  const name = String(node.libelle || node.nom || node.name || "").trim();
  if (!name) return null;

  const isFolder = node.type === "folder" || Array.isArray(node.children);
  if (isFolder) {
    const children = Array.isArray(node.children) ? node.children : [];
    return {
      type: "dossier",
      nom: name,
      enfants: children.map(mapCloudNode).filter(Boolean)
    };
  }

  return { type: "fichier", nom: name };
}

function countTree(nodes) {
  let folders = 0;
  let files = 0;
  for (const node of nodes) {
    if (node.type === "dossier") {
      folders += 1;
      const childCounts = countTree(node.enfants || []);
      folders += childCounts.folders;
      files += childCounts.files;
    } else if (node.type === "fichier") {
      files += 1;
    }
  }
  return { folders, files };
}

export function sanitizeHtml(value) {
  if (typeof value !== "string" || !value) return "";
  let html = value;
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/url\(\s*(["']?)data:[^)]*\1\s*\)/gi, "url()");
  html = html.replace(/<(img|video|audio|iframe|object|embed|svg|canvas|picture|source|track)\b[^>]*>/gi, "");
  html = html.replace(/<\/?(img|video|audio|iframe|object|embed|svg|canvas|picture|source|track)\b[^>]*>/gi, "");
  html = html.replace(/\s(?:src|href|srcset|poster)\s*=\s*(["'])\s*data:[^"']*\1/gi, "");
  return html.trim();
}

export function htmlToText(value) {
  if (typeof value !== "string" || !value) return "";
  let text = sanitizeHtml(value);
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<li\b[^>]*>/gi, "\n• ");
  text = text.replace(/<\/(p|div|li|tr|h[1-6]|blockquote|section|article)>/gi, "\n");
  text = text.replace(/<(p|div|tr|h[1-6]|blockquote|section|article)\b[^>]*>/gi, "\n");
  text = text.replace(/<td\b[^>]*>/gi, "\t");
  text = text.replace(/<[^>]+>/g, " ");
  text = decodeHtmlEntities(text);
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/[ \t\f\v]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export function decodeBase64Utf8(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (/<[a-z!/][^>]*>/i.test(raw)) return raw;

  const cleaned = raw.replace(/\s+/g, "");
  if (cleaned.length < 8 || cleaned.length % 4 !== 0) return raw;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return raw;

  try {
    const binary = atob(cleaned);
    if (!binary) return raw;
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
    if (!decoded) return raw;
    const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
    if (replacementCount > Math.max(1, decoded.length * 0.02)) return raw;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) return raw;
    return decoded;
  } catch {
    return raw;
  }
}

function decodeBase64Field(value) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, "");
  if (cleaned.length < 4 || cleaned.length % 4 !== 0) return raw;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return raw;

  try {
    const binary = atob(cleaned);
    if (!binary) return "";
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
    if (!decoded) return "";
    const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
    if (replacementCount > Math.max(1, decoded.length * 0.02)) return raw;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) return raw;
    return decoded;
  } catch {
    return raw;
  }
}

export function formatPerson(person) {
  if (!person || typeof person !== "object") return "Inconnu";
  const parts = [person.civilite, person.nom, person.prenom]
    .map((part) => typeof part === "string" ? part.trim() : "")
    .filter(Boolean);
  return parts.length ? parts.join(" ").replace(/\s+/g, " ").trim() : "Inconnu";
}

export function toBool(value) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return false;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  const tags = [];
  for (const tag of value) {
    if (typeof tag === "string" && tag.trim()) {
      tags.push(tag.trim());
    } else if (tag && typeof tag === "object") {
      const label = tag.libelle || tag.label || tag.code || tag.nom;
      if (label) tags.push(String(label).trim());
    }
  }
  return tags;
}

function collectAttachmentNames(...arrays) {
  const names = new Set();
  for (const array of arrays) {
    if (!Array.isArray(array)) continue;
    for (const attachment of array) {
      if (!attachment || typeof attachment !== "object") continue;
      const name = attachment.libelle || attachment.nom || attachment.name
        || attachment.fileName || attachment.filename;
      if (name) names.add(String(name).trim());
    }
  }
  return [...names];
}

function summariesFromMessages(messages) {
  const container = messages?.data?.messages;
  const received = Array.isArray(container) ? container : container?.received;
  if (!Array.isArray(received)) return [];
  return received.map((summary) => ({ summary, detail: null }));
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const direct = ENTITY_MAP[entity];
    if (direct !== undefined) return direct;
    const lower = ENTITY_MAP[entity.toLowerCase()];
    if (lower !== undefined) return lower;
    return match;
  });
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === "1";
}

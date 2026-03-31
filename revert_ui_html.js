const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const replacementFields = `<div class="meta-field syntax-field">
                                <select id="draft-syntax" name="syntax">
                                    <option value="Plain Text">Plain Text</option>
                                    <option value="Markdown" selected>Markdown</option>
                                    <option value="MultiMarkdown">MultiMarkdown</option>
                                    <option value="GitHub Markdown">GitHub Markdown</option>
                                    <option value="Taskpaper">Taskpaper</option>
                                    <option value="Simple List">Simple List</option>
                                </select>
                            </div>
                            <span class="meta-sep" aria-hidden="true"></span>
                            <label class="meta-field flagged-field" title="Flag this draft">
                                <input type="checkbox" id="draft-flagged" name="flagged">
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path d="M3 2v12M3 2h9l-2.5 4L12 10H3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Flag</span>
                            </label>
                            <span class="meta-sep" aria-hidden="true"></span>
                            <label class="meta-field location-field" title="Attach location">
                                <input type="checkbox" id="draft-location" name="useLocation">
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path d="M8 1.5A4.5 4.5 0 0112.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 018 1.5z" stroke="currentColor" stroke-width="1.3"/>
                                    <circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.2"/>
                                </svg>
                                <span>Location</span>
                            </label>`;

// Find the end of tags-field
html = html.replace(/<input type="hidden" id="draft-tags" name="tags">\n\s*<\/div>/, `<input type="hidden" id="draft-tags" name="tags">\n                            </div>\n                            ${replacementFields}`);

fs.writeFileSync('public/index.html', html);

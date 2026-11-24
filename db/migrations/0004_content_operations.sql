ALTER TABLE tags ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE resource_tags (
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, tag_id)
);
CREATE TABLE media_tags (
  media_id uuid NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);
CREATE TABLE article_tags (
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE TABLE announcement_tags (
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, tag_id)
);

CREATE INDEX resource_tags_tag_idx ON resource_tags(tag_id);
CREATE INDEX media_tags_tag_idx ON media_tags(tag_id);
CREATE INDEX article_tags_tag_idx ON article_tags(tag_id);
CREATE INDEX announcement_tags_tag_idx ON announcement_tags(tag_id);

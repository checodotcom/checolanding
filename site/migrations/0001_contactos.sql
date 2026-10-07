-- Contactos enviados desde el formulario de checodot.com.
-- Solo se guarda lo que el visitante escribe: sin IP ni otros datos.
CREATE TABLE contactos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  creado_en TEXT    NOT NULL DEFAULT (datetime('now')), -- UTC
  nombre    TEXT    NOT NULL,
  correo    TEXT    NOT NULL,
  mensaje   TEXT    NOT NULL DEFAULT '',
  estado    TEXT    NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'respondido', 'descartado'))
);

CREATE INDEX contactos_estado_idx ON contactos (estado, id);

-- A partir de ahora el Worker guarda `creado_en` en hora de Ciudad de México.
-- Las filas anteriores se guardaron en UTC (default de la tabla): se pasan a hora de México.
-- México no tiene horario de verano desde 2022, así que todas las filas existentes (2026) llevan
-- un desfase de -6 horas. Aplicar ANTES de desplegar el Worker nuevo, o se desplazarían dos veces
-- las filas que éste guarde.
UPDATE contactos SET creado_en = datetime(creado_en, '-6 hours');

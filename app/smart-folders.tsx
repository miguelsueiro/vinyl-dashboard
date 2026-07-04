"use client";

import React, { useState, useMemo } from "react";
import { createSmartFolder, updateSmartFolder, deleteSmartFolder } from "./actions";
import { IconFolder, IconTrash, IconEdit, IconClose, IconPlus, IconVinyl, IconArrowUp, IconArrowDown, IconMinus } from "@/components/icons";
import styles from "./dashboard.module.css";

interface SmartFolder {
  id: string;
  name: string;
  rules: {
    artist?: string;
    genre?: string;
    style?: string;
    label?: string;
    yearMin?: string;
    yearMax?: string;
    priceMin?: string;
    priceMax?: string;
    country?: string;
  };
}

export default function SmartFoldersView({
  records,
  enriched,
  initialSmartFolders
}: {
  records: any[];
  enriched: any[];
  initialSmartFolders: any[];
}) {
  const [folders, setFolders] = useState<SmartFolder[]>(initialSmartFolders || []);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  
  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SmartFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [artistRule, setArtistRule] = useState("");
  const [genreRule, setGenreRule] = useState("");
  const [styleRule, setStyleRule] = useState("");
  const [labelRule, setLabelRule] = useState("");
  const [yearMinRule, setYearMinRule] = useState("");
  const [yearMaxRule, setYearMaxRule] = useState("");
  const [priceMinRule, setPriceMinRule] = useState("");
  const [priceMaxRule, setPriceMaxRule] = useState("");
  const [countryRule, setCountryRule] = useState("");
  
  const [saving, setSaving] = useState(false);

  // Extract select option values dynamically from records
  const artists = useMemo(() => Array.from(new Set(records.map((r: any) => r.artist).filter(Boolean))).sort() as string[], [records]);
  const genres = useMemo(() => Array.from(new Set(records.map((r: any) => r.genre).filter(Boolean))).sort(), [records]);
  const stylesList = useMemo(() => Array.from(new Set(records.map((r: any) => r.style).filter(Boolean))).sort(), [records]);
  const labelsList = useMemo(() => Array.from(new Set(records.map((r: any) => r.label).filter(Boolean))).sort(), [records]);
  const countriesList = useMemo(() => Array.from(new Set(records.map((r: any) => r.country).filter(Boolean))).sort() as string[], [records]);

  // Matching function to filter collection items by folder rules
  const getFolderItems = (folder: SmartFolder) => {
    return enriched.filter((item: any) => {
      const { rules } = folder;
      
      // Artista rule
      if (rules.artist && !item.record?.artist?.toLowerCase().includes(rules.artist.toLowerCase())) {
        return false;
      }
      
      // Genero rule
      if (rules.genre && !item.record?.genre?.toLowerCase().includes(rules.genre.toLowerCase())) {
        return false;
      }
      
      // Estilo rule
      if (rules.style && !item.record?.style?.toLowerCase().includes(rules.style.toLowerCase())) {
        return false;
      }
      
      // Sello rule
      if (rules.label && !item.record?.label?.toLowerCase().includes(rules.label.toLowerCase())) {
        return false;
      }
      
      // Año min/max rule
      if (item.record?.year) {
        const itemYear = parseInt(item.record.year, 10);
        if (rules.yearMin && itemYear < parseInt(rules.yearMin, 10)) return false;
        if (rules.yearMax && itemYear > parseInt(rules.yearMax, 10)) return false;
      } else if (rules.yearMin || rules.yearMax) {
        return false; // has year rules but item doesn't have a year
      }
      
      // Precio min/max rule
      const itemPrice = item.price || 0;
      if (rules.priceMin && itemPrice < parseFloat(rules.priceMin)) return false;
      if (rules.priceMax && itemPrice > parseFloat(rules.priceMax)) return false;

      // País rule
      if (rules.country && !item.record?.country?.toLowerCase().includes(rules.country.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  // Pre-calculate stats for all folders to display on the grid
  const foldersWithStats = useMemo(() => {
    return folders.map(f => {
      const items = getFolderItems(f);
      const totalValue = items.reduce((sum, item) => sum + (item.price || 0), 0);
      return {
        ...f,
        itemCount: items.length,
        totalValue,
        items
      };
    });
  }, [folders, enriched]);

  const activeFolder = foldersWithStats.find(f => f.id === activeFolderId);

  const openCreateModal = () => {
    setEditingFolder(null);
    setFolderName("");
    setArtistRule("");
    setGenreRule("");
    setStyleRule("");
    setLabelRule("");
    setYearMinRule("");
    setYearMaxRule("");
    setPriceMinRule("");
    setPriceMaxRule("");
    setCountryRule("");
    setShowModal(true);
  };

  const openEditModal = (e: React.MouseEvent, folder: SmartFolder) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setFolderName(folder.name);
    setArtistRule(folder.rules.artist || "");
    setGenreRule(folder.rules.genre || "");
    setStyleRule(folder.rules.style || "");
    setLabelRule(folder.rules.label || "");
    setYearMinRule(folder.rules.yearMin || "");
    setYearMaxRule(folder.rules.yearMax || "");
    setPriceMinRule(folder.rules.priceMin || "");
    setPriceMaxRule(folder.rules.priceMax || "");
    setCountryRule(folder.rules.country || "");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setSaving(true);

    const rules = {
      ...(artistRule.trim() && { artist: artistRule.trim() }),
      ...(genreRule && { genre: genreRule }),
      ...(styleRule && { style: styleRule }),
      ...(labelRule && { label: labelRule }),
      ...(yearMinRule.trim() && { yearMin: yearMinRule.trim() }),
      ...(yearMaxRule.trim() && { yearMax: yearMaxRule.trim() }),
      ...(priceMinRule.trim() && { priceMin: priceMinRule.trim() }),
      ...(priceMaxRule.trim() && { priceMax: priceMaxRule.trim() }),
      ...(countryRule && { country: countryRule }),
    };

    if (editingFolder) {
      const res = await updateSmartFolder(editingFolder.id, folderName.trim(), rules);
      if (res.success && res.folder) {
        setFolders(folders.map(f => f.id === editingFolder.id ? (res.folder as SmartFolder) : f));
        setShowModal(false);
      } else {
        alert("Error al actualizar: " + res.error);
      }
    } else {
      const res = await createSmartFolder(folderName.trim(), rules);
      if (res.success && res.folder) {
        setFolders([...folders, res.folder as SmartFolder]);
        setShowModal(false);
      } else {
        alert("Error al crear: " + res.error);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("¿Seguro que quieres eliminar esta carpeta inteligente?")) return;
    
    const res = await deleteSmartFolder(id);
    if (res.success) {
      setFolders(folders.filter(f => f.id !== id));
      if (activeFolderId === id) {
        setActiveFolderId(null);
      }
    } else {
      alert("Error al eliminar: " + res.error);
    }
  };

  const formatEuro = (val: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(val);

  return (
    <div className={styles.foldersContainer}>
      {activeFolder ? (
        // DETAIL VIEW FOR ACTIVE FOLDER
        <div>
          <div className={styles.folderDetailHeader}>
            <button className={styles.backToGridBtn} onClick={() => setActiveFolderId(null)}>
              ← Volver a Carpetas
            </button>
            <div className={styles.folderActionsHeader}>
              <button className={styles.editFolderBtn} onClick={(e) => openEditModal(e, activeFolder)}>
                <IconEdit className={styles.btnIcon} /> Editar Reglas
              </button>
              <button className={styles.deleteFolderBtn} onClick={(e) => handleDelete(e, activeFolder.id)}>
                <IconTrash className={styles.btnIcon} /> Eliminar Carpeta
              </button>
            </div>
          </div>

          <div className={styles.folderDetailStatsCard}>
            <div className={styles.folderDetailName}>📁 {activeFolder.name}</div>
            <div className={styles.folderDetailRulesList}>
              <span className={styles.rulesLabel}>Reglas activas:</span>
              {Object.entries(activeFolder.rules).map(([key, value]) => {
                const labelMap: Record<string, string> = {
                  artist: "Artista",
                  genre: "Género",
                  style: "Estilo",
                  label: "Sello",
                  yearMin: "Año mín",
                  yearMax: "Año máx",
                  priceMin: "Precio mín",
                  priceMax: "Precio máx",
                  country: "País",
                };
                return (
                  <span key={key} className={styles.ruleBadge}>
                    <strong>{labelMap[key] || key}:</strong> {value}
                  </span>
                );
              })}
              {Object.keys(activeFolder.rules).length === 0 && (
                <span className={styles.ruleBadge}>Todo el catálogo (sin filtros)</span>
              )}
            </div>
            <div className={styles.folderKPIs}>
              <div className={styles.folderKPICell}>
                <div className={styles.kLabel}>Álbumes</div>
                <div className={styles.kValue}>{activeFolder.itemCount}</div>
              </div>
              <div className={styles.folderKPICell}>
                <div className={styles.kLabel}>Valor Estimado</div>
                <div className={styles.kValue}>{formatEuro(activeFolder.totalValue)}</div>
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            {activeFolder.items.map((item: any) => (
              <a key={item.release_id} href={`/release/${item.release_id}`} className={styles.card}>
                <div className={styles.coverWrapper}>
                  {item.record?.cover_image ? (
                    <img src={item.record.cover_image} alt="" className={styles.coverImg} />
                  ) : (
                    <IconVinyl className={styles.coverPlaceholderIcon} />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <div className={styles.recordArtist}>{item.record?.artist}</div>
                  <div className={styles.recordTitle}>{item.record?.title}</div>
                  <div className={styles.recordPrice}>
                    <span>{formatEuro(item.price)}</span>
                    <div className={`${styles.trendIndicator} ${styles["trend" + item.trend.charAt(0).toUpperCase() + item.trend.slice(1)]}`}>
                      {item.trend === "up" && <IconArrowUp className={styles.trendIcon} />}
                      {item.trend === "down" && <IconArrowDown className={styles.trendIcon} />}
                      {item.trend === "stable" && <IconMinus className={styles.trendIcon} />}
                      <span>{item.prevPrice > 0 ? formatEuro(item.prevPrice) : "--"}</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
            {activeFolder.items.length === 0 && (
              <div className={styles.emptyFolderMessage}>
                No hay álbumes en la colección que cumplan las reglas de esta carpeta.
              </div>
            )}
          </div>
        </div>
      ) : (
        // GRID VIEW OF ALL SMART FOLDERS
        <div>
          <div className={styles.foldersGridHeader}>
            <h2 className={styles.sectionTitle}>Smart Folders</h2>
            <button className={styles.createFolderBtn} onClick={openCreateModal}>
               Nueva Carpeta
            </button>
          </div>

          <div className={styles.foldersGrid}>
            {foldersWithStats.map(f => (
              <div key={f.id} className={styles.folderCard} onClick={() => setActiveFolderId(f.id)}>
                <div className={styles.folderCardIcon}>📁</div>
                <div className={styles.folderCardContent}>
                  <h3 className={styles.folderCardName}>{f.name}</h3>
                  <div className={styles.folderCardStats}>
                    <span>{f.itemCount} discos</span>
                    <span className={styles.folderCardDot}>•</span>
                    <span>{formatEuro(f.totalValue)}</span>
                  </div>
                </div>
                <div className={styles.folderCardActions}>
                  <button className={styles.folderCardActionBtn} onClick={(e) => openEditModal(e, f)} title="Editar">
                    <IconEdit className={styles.actionIcon} />
                  </button>
                  <button className={styles.folderCardActionBtn} onClick={(e) => handleDelete(e, f.id)} title="Eliminar">
                    <IconTrash className={styles.actionIcon} />
                  </button>
                </div>
              </div>
            ))}
            {folders.length === 0 && (
              <div className={styles.emptyFoldersPlaceholder} onClick={openCreateModal}>
                <div className={styles.bigFolderIcon}>📁</div>
                <h3>Crea tu primera carpeta inteligente</h3>
                <p>Agrupa tus discos dinámicamente por artista, sellos, año o precios de mercado.</p>
                <button className={styles.createFolderBtn} style={{ marginTop: 16 }}>
                  Empezar ahora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FORM MODAL FOR CREATE & EDIT */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>{editingFolder ? "Editar Carpeta Inteligente" : "Nueva Carpeta Inteligente"}</h3>
              <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>
                <IconClose />
              </button>
            </div>
            <form onSubmit={handleSave} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>Nombre de la Carpeta</label>
                <input
                  type="text"
                  placeholder="Ej: Joyas de los 90s, Discos Caros..."
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  required
                  className={styles.modalInput}
                />
              </div>

              <h4 className={styles.rulesSectionTitle}>Definir Reglas de Filtrado</h4>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Artista</label>
                  <input
                    type="text"
                    placeholder="Filtrar por artista..."
                    value={artistRule}
                    onChange={(e) => setArtistRule(e.target.value)}
                    className={styles.modalInput}
                    list="sf-artists-list"
                    autoComplete="off"
                  />
                  <datalist id="sf-artists-list">
                    {artists.map(a => <option key={a} value={a} />)}
                  </datalist>
                </div>
                <div className={styles.formGroup}>
                  <label>Sello Discográfico</label>
                  <select
                    value={labelRule}
                    onChange={(e) => setLabelRule(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Cualquier sello...</option>
                    {labelsList.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Género</label>
                  <select
                    value={genreRule}
                    onChange={(e) => setGenreRule(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Cualquier género...</option>
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Estilo</label>
                  <select
                    value={styleRule}
                    onChange={(e) => setStyleRule(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Cualquier estilo...</option>
                    {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Año Mínimo</label>
                  <input
                    type="number"
                    placeholder="Ej: 1970"
                    value={yearMinRule}
                    onChange={(e) => setYearMinRule(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Año Máximo</label>
                  <input
                    type="number"
                    placeholder="Ej: 1979"
                    value={yearMaxRule}
                    onChange={(e) => setYearMaxRule(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Precio Mínimo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 50"
                    value={priceMinRule}
                    onChange={(e) => setPriceMinRule(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Precio Máximo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ej: 200"
                    value={priceMaxRule}
                    onChange={(e) => setPriceMaxRule(e.target.value)}
                    className={styles.modalInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>País</label>
                  <select
                    value={countryRule}
                    onChange={(e) => setCountryRule(e.target.value)}
                    className={styles.modalSelect}
                  >
                    <option value="">Cualquier país...</option>
                    {countriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup} />
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.submitBtn} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar Carpeta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

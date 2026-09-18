import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import documentUploadService from '../../services/documentUploadService';
import { unifiedNotificationService } from '../../services/unifiedNotificationService';
import { 
  FileText,
  FileImage,
  Download,
  Eye,
  Trash2,
  Calendar,
  User,
  Filter,
  Search,
  AlertCircle,
  Loader,
  File,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink
} from 'lucide-react';

const DOCUMENT_TYPE_LABELS = {
  analyse: { label: 'Analyse médicale', icon: FileText, badge: 'bg-blue-600' },
  radio: { label: 'Radiographie', icon: FileImage, badge: 'bg-purple-600' },
  echographie: { label: 'Échographie', icon: FileImage, badge: 'bg-green-600' },
  scanner: { label: 'Scanner', icon: FileImage, badge: 'bg-indigo-600' },
  irm: { label: 'IRM', icon: FileImage, badge: 'bg-pink-600' },
  ordonnance_externe: { label: 'Ordonnance externe', icon: FileText, badge: 'bg-orange-500' },
  certificat_medical: { label: 'Certificat médical', icon: FileText, badge: 'bg-teal-600' },
  compte_rendu: { label: 'Compte rendu', icon: FileText, badge: 'bg-cyan-600' },
  autre: { label: 'Autre', icon: File, badge: 'bg-gray-500' }
};

const PatientDocumentsViewer = ({ patient, consultationId = null, showUploadButton = false, onUploadClick }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => {
    if (patient?.id) {
      fetchDocuments();
    }
  }, [patient?.id, consultationId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 [PatientDocumentsViewer] Début de la récupération des documents pour patient ID:', patient?.id);
      
      // Récupérer les documents sans jointure pour éviter les erreurs de contrainte
      let query = supabase
        .from('documents_patients')
        .select('*')
        .eq('patient_id', patient.id);

      // Si consultationId est fourni, on affiche tous les documents du patient
      // mais on peut filtrer par consultation_id si nécessaire
      // Pour l'instant, on affiche tous les documents pour que les uploads récents apparaissent
      // Note: Les documents liés à cette consultation auront consultation_id = consultationId

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [PatientDocumentsViewer] Erreur détaillée Supabase:', error);
        throw error;
      }

      console.log('📚 [PatientDocumentsViewer] Documents récupérés:', data?.length || 0);

      // Obtenir la date d'aujourd'hui à minuit en heure locale
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      console.log('📅 [PatientDocumentsViewer] Date d\'aujourd\'hui - Début:', todayStart.toLocaleString('fr-FR'), '| Fin:', todayEnd.toLocaleString('fr-FR'));

      if (data && data.length > 0) {
        let hasNewToday = false;
        data.forEach((doc, index) => {
          if (!doc.created_at) {
            console.log(`  ⚠️ [PatientDocumentsViewer] Document ${index + 1} (${doc.nom_fichier}): pas de date de création`);
            return;
          }
          
          const docDate = new Date(doc.created_at);
          const isToday = docDate >= todayStart && docDate <= todayEnd;
          
          console.log(`  📄 [PatientDocumentsViewer] Document ${index + 1}:`, {
            id: doc.id,
            nom_fichier: doc.nom_fichier,
            type_document: doc.type_document,
            created_at: doc.created_at,
            created_at_iso: docDate.toISOString(),
            created_at_locale: docDate.toLocaleString('fr-FR'),
            isToday: isToday,
            comparison: {
              docDate: docDate.getTime(),
              todayStart: todayStart.getTime(),
              todayEnd: todayEnd.getTime(),
              afterStart: docDate >= todayStart,
              beforeEnd: docDate <= todayEnd
            }
          });
          
          if (isToday) {
            hasNewToday = true;
          }
        });
        
        console.log(`✅ [PatientDocumentsViewer] Statut final: ${hasNewToday ? '🟢 NOUVEAU aujourd\'hui' : '🔵 ANCIEN'}`);
      } else {
        console.log('❌ [PatientDocumentsViewer] Aucun document trouvé pour ce patient');
      }

      // Récupérer les informations utilisateur pour chaque document
      const userIds = [...new Set(data.map(doc => doc.scanned_by).filter(Boolean))];
      const usersMap = new Map();
      
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, nom, prenom, role')
          .in('id', userIds);

        if (!usersError && usersData) {
          usersData.forEach(user => {
            usersMap.set(user.id, user);
          });
        }
      }

      // Aplatir les données pour faciliter l'utilisation
      const formattedData = data.map(doc => {
        const user = usersMap.get(doc.scanned_by);
        return {
          ...doc,
          uploaded_by_nom: user?.nom || null,
          uploaded_by_prenom: user?.prenom || null,
          uploaded_by_role: user?.role || null
        };
      });

      console.log('💾 [PatientDocumentsViewer] Documents formatés et stockés:', formattedData.length);
      setDocuments(formattedData);

      // Vignettes : URLs signées pour les images (le bucket n'est pas public). Un échec
      // n'est pas bloquant : la carte retombe sur l'aperçu générique.
      const imagePaths = formattedData
        .filter((doc) => getMimeType(doc).startsWith('image/') && doc.url_fichier)
        .map((doc) => doc.url_fichier);
      if (imagePaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('patient-documents')
          .createSignedUrls(imagePaths, 3600);
        const map = {};
        (signed || []).forEach((entry) => {
          if (entry?.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
        });
        setThumbnails(map);
      } else {
        setThumbnails({});
      }
    } catch (error) {
      console.error('❌ [PatientDocumentsViewer] Erreur lors du chargement des documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction utilitaire pour détecter le type MIME à partir du nom de fichier
  const getMimeType = (document) => {
    if (document.type_mime) {
      return document.type_mime;
    }
    
    // Fallback: détecter depuis l'extension
    const fileName = document.nom_fichier || document.url_fichier || '';
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'csv': 'text/csv'
    };
    
    return mimeTypes[extension] || 'application/octet-stream';
  };

  const handleDownload = async (document) => {
    try {
      const { data, error } = await supabase.storage
        .from('patient-documents')
        .download(document.url_fichier);

      if (error) throw error;

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.nom_fichier;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      unifiedNotificationService.error('Erreur lors du téléchargement du document');
    }
  };

  const handlePreview = async (document) => {
    try {
      setLoadingPreview(true);
      setSelectedDocument(document);
      setShowPreview(true);

      // Détecter le type MIME (depuis la BDD ou l'extension)
      const mimeType = getMimeType(document);
      const isImage = mimeType.startsWith('image/');
      const isPdf = mimeType === 'application/pdf';

      if (isImage) {
        // Pour les images, télécharger et créer un blob URL
        const { data, error } = await supabase.storage
          .from('patient-documents')
          .download(document.url_fichier);

        if (error) {
          console.error('Erreur téléchargement image:', error);
          throw error;
        }

        const url = URL.createObjectURL(data);
        setPreviewUrl(url);
      } else if (isPdf) {
        // Pour les PDFs, utiliser une URL signée (plus fiable pour les iframes)
        try {
          const signedUrl = await documentUploadService.createSignedUrl(
            'patient-documents',
            document.url_fichier,
            3600 // 1 heure
          );
          setPreviewUrl(signedUrl);
        } catch (signedUrlError) {
          console.warn('Erreur URL signée, tentative avec URL publique:', signedUrlError);
          // Fallback: utiliser l'URL publique
          const publicUrl = documentUploadService.getPublicUrl(
            'patient-documents',
            document.url_fichier
          );
          setPreviewUrl(publicUrl);
        }
      } else {
        // Pour les autres types, essayer l'URL publique
        const publicUrl = documentUploadService.getPublicUrl(
          'patient-documents',
          document.url_fichier
        );
        setPreviewUrl(publicUrl);
      }
    } catch (error) {
      console.error('Erreur lors de l\'aperçu:', error);
      unifiedNotificationService.error(`Erreur lors de l'ouverture du document: ${error.message || 'Fichier non accessible'}`);
      setShowPreview(false);
      setSelectedDocument(null);
      setPreviewUrl(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDelete = async (documentId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      const document = documents.find(d => d.id === documentId);
      
      // Supprimer le fichier du storage
      const { error: storageError } = await supabase.storage
        .from('patient-documents')
        .remove([document.url_fichier]);

      if (storageError) throw storageError;

      // Supprimer l'entrée de la base de données
      const { error: dbError } = await supabase
        .from('documents_patients')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      // Mettre à jour la liste
      setDocuments(prev => prev.filter(d => d.id !== documentId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      unifiedNotificationService.error('Erreur lors de la suppression du document');
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setSelectedDocument(null);
    if (previewUrl) {
      // Nettoyer les blob URLs uniquement (pas les URLs signées/publiques)
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
    }
    setZoom(100);
    setRotation(0);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesType = filterType === 'all' || doc.type_document === filterType;
    const matchesSearch = 
      doc.nom_fichier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      DOCUMENT_TYPE_LABELS[doc.type_document]?.label.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const documentsByType = documents.reduce((acc, doc) => {
    acc[doc.type_document] = (acc[doc.type_document] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec statistiques */}
      <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={24} />
              Documents médicaux
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {documents.length} document{documents.length > 1 ? 's' : ''} disponible{documents.length > 1 ? 's' : ''}
              {documents.length > 0 && ` • Dernier ajout : ${formatDate(documents[0].created_at)}`}
            </p>
          </div>
        {showUploadButton && onUploadClick && (
          <button
            onClick={onUploadClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <FileImage size={20} />
            Scanner un document
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <FileText className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600 font-medium">Aucun document disponible</p>
          <p className="text-sm text-gray-500 mt-1">
            Les documents scannés apparaîtront ici
          </p>
        </div>
      ) : (
        <>
          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les types ({documents.length})</option>
              {Object.entries(documentsByType).map(([type, count]) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]?.label} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Liste des documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => {
              const typeInfo = DOCUMENT_TYPE_LABELS[doc.type_document] || DOCUMENT_TYPE_LABELS.autre;
              const mimeType = getMimeType(doc);
              const isImage = mimeType.startsWith('image/');
              const isPdf = mimeType === 'application/pdf';
              const thumbUrl = thumbnails[doc.url_fichier];
              const linkedToConsultation = consultationId && doc.consultation_id && String(doc.consultation_id) === String(consultationId);

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                >
                  <button
                    type="button"
                    onClick={() => handlePreview(doc)}
                    title="Voir en grand"
                    className="relative block w-full aspect-[4/3] border-0 p-0 cursor-pointer overflow-hidden bg-slate-100"
                  >
                    {isImage && thumbUrl ? (
                      <img src={thumbUrl} alt={doc.nom_fichier} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-slate-300">
                        {isImage ? <FileImage size={56} /> : <FileText size={56} />}
                      </span>
                    )}
                    <span className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                      {linkedToConsultation && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-green-600 text-white" title="Document lié à cette consultation">
                          Cette consultation
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full text-white ${typeInfo.badge}`}>
                        {typeInfo.label}
                      </span>
                    </span>
                    <span className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900/75 text-white text-[11px] font-medium">
                      {isPdf ? 'PDF' : isImage ? <><ZoomIn size={12} /> Agrandir</> : 'Fichier'}
                    </span>
                  </button>

                  <div className="p-3.5 flex flex-col gap-2 flex-1">
                    <h4 className="font-semibold text-gray-800 text-[15px] truncate" title={doc.nom_fichier}>
                      {doc.nom_fichier}
                    </h4>
                    <p className="text-[13px] text-gray-500">
                      {formatDate(doc.date_document || doc.created_at)}
                      {(doc.uploaded_by_nom || doc.uploaded_by_prenom) && ` • ${[doc.uploaded_by_prenom, doc.uploaded_by_nom].filter(Boolean).join(' ')}`}
                      {doc.taille_fichier ? ` • ${formatFileSize(doc.taille_fichier)}` : ''}
                    </p>
                    {doc.notes && (
                      <p className="text-[13px] text-gray-600 italic line-clamp-2">"{doc.notes}"</p>
                    )}

                    <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handlePreview(doc)}
                        className="flex-1 px-2.5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-[13px] flex items-center justify-center gap-1"
                      >
                        <Eye size={15} />
                        Voir
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="px-2.5 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                        title="Télécharger"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="px-2.5 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <AlertCircle className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-600">Aucun document ne correspond à votre recherche</p>
            </div>
          )}
        </>
      )}

      {/* Modal de prévisualisation */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-800 truncate">
                  {selectedDocument?.nom_fichier}
                </h3>
                <p className="text-sm text-gray-600">
                  {DOCUMENT_TYPE_LABELS[selectedDocument?.type_document]?.label} - 
                  {formatDate(selectedDocument?.date_document)}
                </p>
              </div>
              
              {/* Contrôles de zoom pour les images */}
              {selectedDocument && getMimeType(selectedDocument).startsWith('image/') && (
                <div className="flex items-center gap-2 mx-4">
                  <button
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Zoom arrière"
                  >
                    <ZoomOut size={20} />
                  </button>
                  <span className="text-sm font-medium min-w-[60px] text-center">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Zoom avant"
                  >
                    <ZoomIn size={20} />
                  </button>
                  <button
                    onClick={() => setRotation((rotation + 90) % 360)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                    title="Rotation"
                  >
                    <RotateCw size={20} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedDocument)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <Download size={18} />
                  Télécharger
                </button>
                <button
                  onClick={closePreview}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="animate-spin text-blue-600" size={48} />
                </div>
              ) : selectedDocument && getMimeType(selectedDocument).startsWith('image/') ? (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={previewUrl}
                    alt={selectedDocument.nom_fichier}
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s'
                    }}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : selectedDocument && getMimeType(selectedDocument) === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[600px] rounded-lg"
                  title={selectedDocument.nom_fichier}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                  <File size={64} className="mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">
                    Prévisualisation non disponible
                  </p>
                  <p className="text-sm mb-4">
                    Ce type de fichier ne peut pas être prévisualisé
                  </p>
                  <button
                    onClick={() => handleDownload(selectedDocument)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <Download size={20} />
                    Télécharger le fichier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDocumentsViewer;


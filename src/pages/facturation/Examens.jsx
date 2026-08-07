import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import KpiCard from '../../components/common/KpiCard';
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    CalendarIcon,
    UserIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

const ExamensPage = () => {
    const [examens, setExamens] = useState([]);
    const [consultations, setConsultations] = useState([]);
    const [typesExamens, setTypesExamens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingExamen, setEditingExamen] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatut, setFilterStatut] = useState('');
    const [filterUrgence, setFilterUrgence] = useState('');

    // État du formulaire
    const [formData, setFormData] = useState({
        consultation_id: '',
        patient_id: '',
        type_examen: '',
        description: '',
        urgence: false,
        date_prescription: new Date().toISOString().split('T')[0],
        date_realisation: '',
        statut: 'prescrit',
        resultat: '',
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Récupérer les consultations
            const { data: consultationsData, error: consultationsError } = await supabase
                .from('consultations')
                .select(`
                    id,
                    date_consultation,
                    patients (id, nom, prenom),
                    users (nom, prenom)
                `)
                .order('date_consultation', { ascending: false });

            if (consultationsError) throw consultationsError;
            setConsultations(consultationsData || []);

            // Récupérer les types d'examens
            const { data: typesData, error: typesError } = await supabase
                .from('types_examens')
                .select('*')
                .eq('actif', true)
                .order('nom');

            if (typesError) throw typesError;
            setTypesExamens(typesData || []);

            // Récupérer les examens
            await fetchExamens();

        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchExamens = async () => {
        try {
            const { data, error } = await supabase
                .from('examens_prescrits')
                .select(`
                    *,
                    consultations (
                        date_consultation,
                        patients (nom, prenom),
                        users (nom, prenom)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setExamens(data || []);
        } catch (error) {
            console.error('Erreur lors du chargement des examens:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        try {
            const examenData = {
                ...formData,
                created_by: (await supabase.auth.getUser()).data.user?.id
            };

            if (editingExamen) {
                const { error } = await supabase
                    .from('examens_prescrits')
                    .update(examenData)
                    .eq('id', editingExamen.id);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('examens_prescrits')
                    .insert(examenData);

                if (error) throw error;
            }

            setShowModal(false);
            setEditingExamen(null);
            resetForm();
            fetchExamens();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        }
    };

    const handleEdit = (examen) => {
        setEditingExamen(examen);
        setFormData({
            consultation_id: examen.consultation_id,
            patient_id: examen.patient_id,
            type_examen: examen.type_examen,
            description: examen.description || '',
            urgence: examen.urgence,
            date_prescription: examen.date_prescription,
            date_realisation: examen.date_realisation || '',
            statut: examen.statut,
            resultat: examen.resultat || '',
            notes: examen.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cet examen ?')) {
            try {
                const { error } = await supabase
                    .from('examens_prescrits')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                fetchExamens();
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            consultation_id: '',
            patient_id: '',
            type_examen: '',
            description: '',
            urgence: false,
            date_prescription: new Date().toISOString().split('T')[0],
            date_realisation: '',
            statut: 'prescrit',
            resultat: '',
            notes: ''
        });
    };

    const handleConsultationChange = (consultationId) => {
        const consultation = consultations.find(c => c.id === parseInt(consultationId));
        setFormData(prev => ({
            ...prev,
            consultation_id: consultationId,
            patient_id: consultation ? consultation.patients.id : ''
        }));
    };

    const getStatutColor = (statut) => {
        switch (statut) {
            case 'prescrit': return 'bg-blue-100 text-blue-800';
            case 'en_cours': return 'bg-yellow-100 text-yellow-800';
            case 'termine': return 'bg-green-100 text-green-800';
            case 'annule': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredExamens = examens.filter(examen => {
        const matchesSearch = 
            examen.consultations?.patients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            examen.consultations?.patients?.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            examen.type_examen?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatut = !filterStatut || examen.statut === filterStatut;
        const matchesUrgence = filterUrgence === '' || examen.urgence === (filterUrgence === 'true');
        
        return matchesSearch && matchesStatut && matchesUrgence;
    });

    const stats = {
        total: filteredExamens.length,
        prescrits: filteredExamens.filter(e => e.statut === 'prescrit').length,
        enCours: filteredExamens.filter(e => e.statut === 'en_cours').length,
        termines: filteredExamens.filter(e => e.statut === 'termine').length,
        urgents: filteredExamens.filter(e => e.urgence).length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                {/* En-tête */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <CalendarIcon className="h-8 w-8 mr-3 text-blue-600" />
                            Examens Prescrits
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Gestion des examens complémentaires prescrits par les médecins
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors"
                    >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Nouvel Examen
                    </button>
                </div>

                {/* Statistiques */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                    <KpiCard icon={CalendarIcon} tone="blue" label="Total" value={stats.total} />
                    <KpiCard icon={ClockIcon} tone="blue" label="Prescrits" value={stats.prescrits} />
                    <KpiCard icon={ClockIcon} tone="yellow" label="En Cours" value={stats.enCours} />
                    <KpiCard icon={ClockIcon} tone="green" label="Terminés" value={stats.termines} />
                    <KpiCard icon={ExclamationTriangleIcon} tone="red" label="Urgents" value={stats.urgents} />
                </div>

                {/* Filtres */}
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rechercher
                            </label>
                            <input
                                type="text"
                                placeholder="Patient, type d'examen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Statut
                            </label>
                            <select
                                value={filterStatut}
                                onChange={(e) => setFilterStatut(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Tous les statuts</option>
                                <option value="prescrit">Prescrit</option>
                                <option value="en_cours">En cours</option>
                                <option value="termine">Terminé</option>
                                <option value="annule">Annulé</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Urgence
                            </label>
                            <select
                                value={filterUrgence}
                                onChange={(e) => setFilterUrgence(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Tous</option>
                                <option value="true">Urgents</option>
                                <option value="false">Non urgents</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tableau des examens */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Patient
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type d'Examen
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date Prescription
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Statut
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Urgence
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredExamens.map((examen) => (
                                    <tr key={examen.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {examen.consultations?.patients?.nom} {examen.consultations?.patients?.prenom}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(examen.consultations?.date_consultation).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {examen.type_examen}
                                            </div>
                                            {examen.description && (
                                                <div className="text-sm text-gray-500">
                                                    {examen.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {new Date(examen.date_prescription).toLocaleDateString()}
                                            </div>
                                            {examen.date_realisation && (
                                                <div className="text-sm text-gray-500">
                                                    Réalisé: {new Date(examen.date_realisation).toLocaleDateString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatutColor(examen.statut)}`}>
                                                {examen.statut}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {examen.urgence ? (
                                                <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleEdit(examen)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                >
                                                    <PencilIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(examen.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                    >
                        <h2 className="text-2xl font-bold mb-6">
                            {editingExamen ? 'Modifier l\'Examen' : 'Nouvel Examen'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Consultation
                                    </label>
                                    <select
                                        required
                                        value={formData.consultation_id}
                                        onChange={(e) => handleConsultationChange(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Sélectionner une consultation</option>
                                        {consultations.map(consultation => (
                                            <option key={consultation.id} value={consultation.id}>
                                                {consultation.patients?.nom} {consultation.patients?.prenom} - 
                                                {new Date(consultation.date_consultation).toLocaleDateString()}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Type d'Examen
                                    </label>
                                    <select
                                        required
                                        value={formData.type_examen}
                                        onChange={(e) => setFormData(prev => ({ ...prev, type_examen: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Sélectionner un type d'examen</option>
                                        {typesExamens.map(type => (
                                            <option key={type.id} value={type.nom}>
                                                {type.nom}
                                            </option>
                                        ))}
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date de Prescription
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date_prescription}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date_prescription: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date de Réalisation
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date_realisation}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date_realisation: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Statut
                                    </label>
                                    <select
                                        required
                                        value={formData.statut}
                                        onChange={(e) => setFormData(prev => ({ ...prev, statut: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="prescrit">Prescrit</option>
                                        <option value="en_cours">En cours</option>
                                        <option value="termine">Terminé</option>
                                        <option value="annule">Annulé</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="urgence"
                                    checked={formData.urgence}
                                    onChange={(e) => setFormData(prev => ({ ...prev, urgence: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="urgence" className="ml-2 block text-sm text-gray-900">
                                    Examen urgent
                                </label>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Résultat
                                </label>
                                <textarea
                                    value={formData.resultat}
                                    onChange={(e) => setFormData(prev => ({ ...prev, resultat: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Résultats de l'examen..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Notes
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingExamen(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    {editingExamen ? 'Modifier' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default ExamensPage;

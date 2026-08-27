Each folder contains the data of atomistic models of carbon polymorphs from five different classes: 1) Amorphous Carbon, 2) Carbide Derived Carbon, 3) Irradiated Graphite, 4) Phase Separated Phase and 5) Variable Porosity Carbon. For more details about the naming convention, see the article referenced in this Materials Cloud submission.
All structures were relaxed with the GAP potential [P. Rowe, V. L. Deringer, P. Gasparotto, G. Csányi, and A. Michaelides, The Journal of Chemical Physics 153, 034702 (2020)]

-----------------------------------------------------------------------------

If these structural models helped you in your research, please cite the paper (or the equivalent mentioned in the references of the Materials Cloud submission): 

K. Iwanowski, G. Csányi, M. Simoncelli, 
Bond-network entropy governs heat transport in coordination-disordered solids, arXiv:2412.12753 (2024)
URL: https://arxiv.org/abs/2412.12753

If you used the structures in carbide_derived_carbon, please also cite:

J. C. Palmer, A. Llobet, S. H. Yeon, J. E. Fischer, Y. Shi, Y. Gogotsi, and K. E. Gubbins, 
Modeling the structural evolution of carbide-derived carbons using quenched molecular dynamics, Carbon 48, 1116 (2010)
URL: https://doi.org/10.1016/j.carbon.2009.11.033

If you used the structures in irradiated_graphite, please also cite:

B. Farbos, H. Freeman, T. Hardcastle, J.-P. Da Costa, R. Brydson, A. J. Scott, P. Weisbecker, C. Germain, G. L. Vignoles, and J.-M. Leyssale, 
A time-dependent atomistic reconstruction of severe irradiation damage and associated property changes in nuclear graphite, Carbon 120, 111 (2017).
URL: https://doi.org/10.1016/j.carbon.2017.05.009

-----------------------------------------------------------------------------

Each structure has a filename "POSCAR" placed within its named folder.

amorphous_carbon folder contains 10 structures and the folders containing them have a following naming convention:
density_"relaxed density"_"number of atoms" where the "relaxed density" corresponds to approximate density in g/cm$^3$ of the structure after relaxation with the GAP potential, where the decimal point has been replaced with the letter d. The "number of atoms" denotes the number of atoms in the model. For example the folder density_1d5_8000 contains a model of amorphous carbon with 8000 atoms, whose density after relaxation was approximately equal to 1.5 g/cm$^3$.

carbide_derived_carbon contains 3 structures: CDC800, CDC1200 and ann-CDC1200.

irradiated_graphite contains 5 structures: IRG T2, IRG T3, IRG T5 and IRG T9 with 14009 atoms, and IRG T9 with 216 atoms.

phase_separated_phase folder contains a single folder psp containing the structure.

Finally, variable_porosity_carbon includes three folders: 1) vpc_t_1d5 containing the VPC(T) 1.5 structure. 2) vpc_d containing structures of VPC(D) 0.9, VPC(D) 1.5 and VPC(D) 1.9. The folders have the same naming convention as in amorphous_carbon. 3) vpc_d_200 containing structures of Variable Porosity Carbon with approximately 200 atoms. These include VPC(D) 0.9 (model 4) [density_0d9_model_4], VPC(D) 0.9 (model 9) [density_0d9_model_9], VPC(D) 1.4 (model 8) [density_1d4_model_8] and VPC(D) 2.0 (model 9) [density_2d0_model_9]
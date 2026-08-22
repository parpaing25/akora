import { Link } from "react-router-dom";
import { LogOut, LayoutDashboard, Shield, Menu as MenuIcone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Bouton } from "@/components/ui/button";
import {
  Menu,
  MenuContenu,
  MenuDeclencheur,
  MenuElement,
  MenuSeparateur,
} from "@/components/ui/dropdown-menu";

/**
 * Menu du compte connecté.
 *
 * Chargé à la demande : les composants Radix qui le composent — menu
 * déroulant, portail, gestion du focus — pesaient sur le premier rendu de
 * l'accueil, alors qu'un visiteur non connecté ne les voit jamais.
 */
export default function MenuCompte() {
  const { deconnexion, roles } = useAuth();

  return (
    <Menu>
      <MenuDeclencheur asChild>
        <Bouton variante="fantome" taille="icone" aria-label="Mon compte">
          <MenuIcone className="size-5" aria-hidden="true" />
        </Bouton>
      </MenuDeclencheur>
      <MenuContenu>
        <MenuElement asChild>
          <Link to="/compte">Mon compte</Link>
        </MenuElement>
        <MenuElement asChild>
          <Link to="/compte/commandes">Mes commandes</Link>
        </MenuElement>
        {roles.includes("fournisseur") ? (
          <MenuElement asChild>
            <Link to="/pro">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Espace fournisseur
            </Link>
          </MenuElement>
        ) : null}
        {roles.includes("admin") ? (
          <MenuElement asChild>
            <Link to="/admin">
              <Shield className="size-4" aria-hidden="true" />
              Administration
            </Link>
          </MenuElement>
        ) : null}
        <MenuSeparateur />
        <MenuElement onSelect={() => void deconnexion()}>
          <LogOut className="size-4" aria-hidden="true" />
          Se déconnecter
        </MenuElement>
      </MenuContenu>
    </Menu>
  );
}

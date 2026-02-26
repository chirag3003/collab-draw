package repository

var repo *Repository

type Repository struct {
	Project   ProjectRepository
	Workspace WorkspaceRepository
	User      UserRepository
	Operation OperationRepository
}

func Setup() *Repository {
	repo = &Repository{
		Project:   NewProjectRepository(),
		Workspace: NewWorkspaceRepository(),
		User:      NewUserRepository(),
		Operation: NewOperationRepository(),
	}
	return repo
}

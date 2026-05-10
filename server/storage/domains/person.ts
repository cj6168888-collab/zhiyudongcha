import { personRepository } from '../../repositories';
import type { Person, RelationshipInsight, InsertPerson } from '@shared/schema';

export interface IPersonStorage {
  getPerson(id: string): Promise<Person | undefined>;
  getAllPersons(accessLevel?: string): Promise<Person[]>;
  createPerson(person: InsertPerson): Promise<Person>;
  updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined>;
  deletePerson(id: string): Promise<boolean>;
  searchPersonsByWeakness(keyword: string): Promise<Person[]>;
  findConflictingRelationships(personId: string): Promise<Person[]>;
  getRelationshipInsight(personName: string): Promise<RelationshipInsight | null>;
  getPersonsByApprovalStatus(status: string): Promise<Person[]>;
  getPersonsByOrganization(organization: string): Promise<Person[]>;
}

export class PersonStorage implements IPersonStorage {
  async getPerson(id: string): Promise<Person | undefined> {
    return await personRepository.findById(id);
  }

  async getAllPersons(accessLevel?: string): Promise<Person[]> {
    return await personRepository.getAllByAccessLevel(accessLevel);
  }

  async createPerson(person: InsertPerson): Promise<Person> {
    return await personRepository.create(person);
  }

  async updatePerson(id: string, person: Partial<InsertPerson>): Promise<Person | undefined> {
    return await personRepository.update(id, person);
  }

  async deletePerson(id: string): Promise<boolean> {
    return await personRepository.delete(id);
  }

  async searchPersonsByWeakness(keyword: string): Promise<Person[]> {
    return await personRepository.searchByWeakness(keyword);
  }

  async findConflictingRelationships(personId: string): Promise<Person[]> {
    return await personRepository.findConflictingRelationships(personId);
  }

  async getRelationshipInsight(personName: string): Promise<RelationshipInsight | null> {
    return await personRepository.getRelationshipInsight(personName);
  }

  async getPersonsByApprovalStatus(status: string): Promise<Person[]> {
    return await personRepository.getByApprovalStatus(status);
  }

  async getPersonsByOrganization(organization: string): Promise<Person[]> {
    return await personRepository.getByOrganization(organization);
  }
}

export const personStorage = new PersonStorage();
